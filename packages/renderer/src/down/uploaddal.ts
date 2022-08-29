import type { IAriaDownProgress } from "./downdal"
import path from 'path'
import { GetKeyHashNumber, humanSize } from '@/utils/format'
import message from '@/utils/message'
import type { IStateUploadFile } from '@/aliapi/models'
import useUploadingStore from '@/down/uploadingstore'
import useUploadedStore from '@/down/uploadedstore'
import DB from '@/utils/db'
import useSettingStore from '@/setting/settingstore'
import { UploadAdd, UploadCmd } from '@/down/uploadservice'
import fsPromises from 'fs/promises'

export default class UploadDAL {

  /**
   * 从DB中加载数据
   */
  static async aLoadUploadedFromDB() {
    const uploadedStore = useUploadedStore()
    uploadedStore.ListDataRaw = await DB.getUploadedAll()
    uploadedStore.mRefreshListDataShow(true)
  }

  /**
   * 从DB中加载数据
   */
  static async aLoadFromDB() {
    const uploadingStore = useUploadingStore()
    uploadingStore.ListLoading = true
    const UploadedList = await DB.getUploadingAll()
    // 首次从DB中加载数据，如果上次意外停止则重新开始，如果手动暂停则保持
    for (const stateUploadFile of UploadedList) {
      if (!stateUploadFile.Upload.IsStop && stateUploadFile.Upload.DownState != '队列中') {
        const upload = stateUploadFile.Upload
        upload.IsDowning = false
        upload.IsCompleted = false
        upload.IsStop = false
        upload.DownState = '队列中'
        upload.DownSpeed = 0;
        upload.DownSpeedStr = ''
        upload.IsFailed = false
        upload.FailedCode = 0;
        upload.FailedMessage = ''
        upload.AutoTry = 0;
        upload.IsDowning = false
      }
    }
    uploadingStore.ListDataRaw = UploadedList
    uploadingStore.mRefreshListDataShow(true)
    uploadingStore.ListLoading = false
    this.aLoadUploadedFromDB().then(r => {})
  }

  /**
   * 上传事件动作 <br/>
   * 在上传列表中，计算要上传的文件 <br/>
   * 并调用 @/down/uploadservice -> UploadAdd
   * @param list
   */
  static aUploadEvent(list: IAriaDownProgress[]) {
    const uploadingStore = useUploadingStore();
    const UploadingList = uploadingStore.ListDataRaw
    if (list == undefined) list = [];
    UploadDAL.mUploadEvent(list)

    let downingCount = 0
    let downingCountMC = 0

    for (let j = 0; j < UploadingList.length; j++) {
      if (UploadingList[j].Upload.IsDowning) {
        if (UploadingList[j].Info.isMiaoChuan) downingCountMC++
        else downingCount++
      }
      if (UploadingList[j].Upload.IsCompleted && UploadingList[j].Upload.DownState === '已完成') {
        UploadDAL.mSaveToUploaded(UploadingList[j].UploadID)
        j--
      }
    }
    const time = Date.now() - 60 * 1000
    const addlist: IStateUploadFile[] = [];
    const uploadFileMax = useSettingStore().uploadFileMax
    for (let j = 0; j < UploadingList.length; j++) {
      if (downingCount >= uploadFileMax) break
      const down = UploadingList[j].Upload
      if (down.IsCompleted == false && down.IsDowning == false && down.IsStop == false) {
        if ((down.IsFailed == false || time > down.AutoTry) && UploadingList[j].Info.isMiaoChuan == false) {
          downingCount++
          UploadDAL.mUpdateUploadingState({ UploadID: UploadingList[j].UploadID, IsDowning: true, DownSpeedStr: '', DownState: '解析中', DownTime: Date.now(), FailedCode: 0, FailedMessage: '' })
          addlist.push(UploadingList[j])
        }
      }
    }
    const downFileMaxMC = 40 - downingCount
    for (let j = 0; j < UploadingList.length; j++) {
      if (downingCountMC >= downFileMaxMC) break
      const down = UploadingList[j].Upload
      if (down.IsCompleted == false && down.IsDowning == false && down.IsStop == false) {
        if ((down.IsFailed == false || time > down.AutoTry) && UploadingList[j].Info.isMiaoChuan) {
          downingCountMC++
          UploadDAL.mUpdateUploadingState({ UploadID: UploadingList[j].UploadID, IsDowning: true, DownSpeedStr: '', DownState: '解析中', DownTime: Date.now(), FailedCode: 0, FailedMessage: '' });
          addlist.push(UploadingList[j])
        }
      }
    }

    //if (addlist.length > 0 && window.WinMsgToUI) window.WinMsgToUI({ cmd: 'UploadAdd', addlist });
    if (addlist.length > 0) UploadAdd(addlist)
    uploadingStore.mRefreshListDataShow(true)

  }

  /**
   * 上传事件方法 <br/>
   * 计算状态的变化
   * @param list
   */
  static mUploadEvent(list: IAriaDownProgress[]) {
    const uploadingStore = useUploadingStore();
    const UploadingList = uploadingStore.ListDataRaw
    if (list == undefined) list = [];
    const dellist: string[] = [];

    // TODO 这里是不是可以做优化，没有必要每秒对UploadingList做循环，只对执行中的列表循环即可
    for (let n = 0; n < UploadingList.length; n++) {
      if (UploadingList[n].Upload.DownSpeedStr != '') {
        const UploadID = UploadingList[n].UploadID;
        let isFind = false;
        for (let m = 0; m < list.length; m++) {
          if (list[m].gid != UploadID) continue
          if (list[m].status == '解析中' || list[m].status.indexOf('%') > -1) {
            isFind = true;
            break;
          }
        }
        if (!isFind) {
          if (UploadingList[n].Upload.DownState != '已暂停') UploadingList[n].Upload.DownState = '队列中'
          UploadingList[n].Upload.DownSpeed = 0
          UploadingList[n].Upload.DownSpeedStr = ''
        }
      }
    }

    const savelist: IStateUploadFile[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const UploadID = list[i].gid;

        const isComplete = list[i].status === '已完成';
        const isDowning = list[i].status === '上传中' || list[i].status.indexOf('%') > -1;
        const isStop = list[i].status === '已暂停' || list[i].status === '待删除';
        const isError = !isComplete && list[i].status === '已出错';

        for (let j = 0; j < UploadingList.length; j++) {
          if (UploadingList[j].UploadID == UploadID) {

            const downitem = UploadingList[j];
            const down = downitem.Upload;
            const totalLength = parseInt(list[i].totalLength) || 0;
            down.DownSize = parseInt(list[i].completedLength) || 0;
            down.DownSpeed = parseInt(list[i].downloadSpeed) || 0;
            down.DownSpeedStr = humanSize(down.DownSpeed) + '/s';
            down.DownProcess = Math.floor((down.DownSize * 100) / (totalLength + 1)) % 100;


            down.IsCompleted = isComplete;
            down.IsDowning = isDowning;
            down.IsFailed = isError;
            down.IsStop = isStop;

            if (list[i].errorCode && list[i].errorCode != '0') {
              down.FailedCode = parseInt(list[i].errorCode) || 0;
              down.FailedMessage = list[i].errorMessage;
            }

            if (isComplete) {
              down.DownState = '已完成';
              down.DownSize = downitem.Info.size;
              down.DownSpeed = 0;
              down.DownSpeedStr = '';
              down.DownProcess = 100;
              down.FailedCode = 0;
              down.FailedMessage = '';
              down.AutoTry = 0;
              down.IsDowning = false
              down.IsStop = true
            } else if (isStop) {
              down.DownState = '已暂停';
              down.DownSpeed = 0;
              down.DownSpeedStr = '';
              down.FailedCode = 0;
              down.FailedMessage = '';
              down.IsDowning = false
            } else if (isError) {
              down.DownState = '待重试';
              down.DownSpeed = 0;
              down.DownSpeedStr = '';
              down.AutoTry = Date.now();
              if (down.FailedMessage == '') down.FailedMessage = '上传失败';
              down.IsDowning = false
            } else if (isDowning) {
              down.FailedMessage = list[i].errorMessage;
              let lasttime = ((totalLength - down.DownSize) / (down.DownSpeed + 1)) % 356400;
              if (lasttime < 1) lasttime = 1;
              down.DownState =
                down.DownProcess.toString() +
                '% ' +
                (lasttime / 3600).toFixed(0).padStart(2, '0') +
                ':' +
                ((lasttime % 3600) / 60).toFixed(0).padStart(2, '0') +
                ':' +
                (lasttime % 60).toFixed(0).padStart(2, '0')
              DB.saveUploading(downitem.UploadID, JSON.parse(JSON.stringify(downitem)))
            } else {
              //console.log('update', UploadingList[j]);
            }
            if (isStop || isError) {
              dellist.push(UploadID);
            }
            uploadingStore.mRefreshListDataShow(true)
            break;
          }
        }
      } catch {}
    }
    if (dellist.length > 0) {
      UploadCmd(false,'delete', dellist)
      // if (window.WinMsgToUI) window.WinMsgToUI({ cmd: 'UploadCmd', uploadCmd: 'delete', uploadAll: false, uploadIDList: dellist });
    }
  }

  static mUpdateUploadingState(data: any) {
    const uploadingStore = useUploadingStore();
    const UploadingList = uploadingStore.ListDataRaw
    const UploadID = data.UploadID;
    for (let j = 0; j < UploadingList.length; j++) {
      if (UploadingList[j].UploadID == UploadID) {
        UploadingList[j].Upload = { ...UploadingList[j].Upload, ...data };
        break;
      }
    }
    uploadingStore.mRefreshListDataShow(true)
  }

  /**
   * 将上传完成的删除并保存到上传历史中
   * @param UploadID
   */
  static mSaveToUploaded(UploadID: string) {
    const uploadingStore = useUploadingStore()
    const uploadedStore = useUploadedStore()
    const UploadingList = uploadingStore.ListDataRaw
    for (let j = 0; j < UploadingList.length; j++) {
      if (UploadingList[j].UploadID == UploadID && UploadingList[j].Upload.DownState === '已完成') {
        const item = UploadingList[j]
        UploadingList.splice(j, 1)
        DB.deleteUploading(item.UploadID)
        item.Upload.DownTime = Date.now()
        item.UploadID = item.Upload.DownTime.toString() + '_' + item.UploadID
        uploadedStore.ListDataRaw.splice(0, 0, item)
        uploadedStore.mRefreshListDataShow(true)  // TODO 当上传数量较大时会不会不性能问题
        DB.saveUploaded(item.UploadID, JSON.parse(JSON.stringify(item)))
        break
      }
    }
    if (uploadingStore.ListSelected.has(UploadID)) uploadingStore.ListSelected.delete(UploadID)
  }

  /**
   * 上传目录
   * @param user_id
   * @param drive_id
   * @param parentid
   * @param localDirPath
   */
  static UploadLocalDir(user_id: string, drive_id: string, parentid: string, localDirPath: string) {}

  /**
   * 上传多个本地文件
   * @param user_id
   * @param drive_id
   * @param parentid
   * @param files
   * @param tip
   */
  static async UploadLocalFiles(user_id: string, drive_id: string, parentid: string, files: string[], tip: boolean) {
    if (files == undefined || files.length == 0) return 0;
    const uploadinglist: IStateUploadFile[] = [];
    let subpath = path.dirname(files[0]);
    if (subpath.endsWith('/') || subpath.endsWith('\\')) subpath = subpath.substr(0, subpath.length - 1);
    const sublen = subpath.length + 1;
    const PIDHex = GetKeyHashNumber(user_id + '_' + drive_id).toString(16) + '_' + GetKeyHashNumber(parentid).toString(16);
    const plist: Promise<void>[] = [];
    let dtime = Date.now();
    for (let i = 0; i < files.length; i++) {
      let filepath = files[i];
      if (filepath.endsWith('$RECYCLE.BIN')) continue;
      if (filepath.endsWith('System Volume Information')) continue;
      if (filepath.endsWith('Thumbs.db')) continue;
      if (filepath.endsWith('desktop.ini')) continue;
      if (filepath.endsWith('.DS_Store')) continue;
      plist.push(
        fsPromises
          .lstat(filepath)
          .then((stat: any) => {
            let isdir = false;
            if (stat.isDirectory()) {
              isdir = true;
              if (filepath.endsWith('/')) filepath = filepath.substr(0, filepath.length - 1);
              else if (filepath.endsWith('\\')) filepath = filepath.substr(0, filepath.length - 1);
            }

            const UploadID = PIDHex + GetKeyHashNumber(filepath).toString(16) + '_' + stat.size.toString(16);
            uploadinglist.push({
              UploadID: UploadID,
              Info: {
                user_id: user_id,
                localFilePath: isdir ? filepath + path.sep : filepath,
                path: '',
                parent_id: parentid,
                drive_id: drive_id,
                name: filepath.substr(sublen),
                size: stat.size,
                sizestr: humanSize(stat.size),
                icon: isdir ? 'iconfont iconfolder' : 'iconfont iconwenjian',
                isDir: isdir,
                isMiaoChuan: false,
                sha1: '',
                crc64: '',
              },
              Upload: {
                DownState: '',
                DownTime: dtime++,
                DownSize: 0,
                DownSpeed: 0,
                DownSpeedStr: '',
                DownProcess: 0,
                IsStop: false,
                IsDowning: false,
                IsCompleted: false,
                IsFailed: false,
                FailedCode: 0,
                FailedMessage: '',
                AutoTry: 0,
                upload_id: '',
                file_id: '',
                IsBreakExist: false
              },
            });
          })
          .catch((e: any) => {
            message.info(JSON.stringify(e));
            console.log(filepath, e);
          })
      );
    }
    await Promise.all(plist);
    useUploadingStore().mAddUploading({ uploadinglist, tip });
    return uploadinglist.length;
  }

  /**
   * 保存到下载中
   * @param UploadID
   * @param file_id
   * @param upload_id
   */
  static mSaveToUploading(UploadID: string, file_id: string, upload_id: string) {
    const uploadingStore = useUploadingStore()
    const UploadingList = uploadingStore.ListDataRaw
    for (let j = 0; j < UploadingList.length; j++) {
      if (UploadingList[j].UploadID == UploadID) {
        UploadingList[j].Upload.file_id = file_id
        UploadingList[j].Upload.upload_id = upload_id
        DB.saveUploading(UploadingList[j].UploadID, JSON.parse(JSON.stringify(UploadingList[j])))
        break;
      }
    }
  }

  /**
   * 查询是否上传中
   */
  static QueryIsUploading() {
    return false
  }

  /**
   * 查询选择的是否上传中
   */
  static QuerySelectedIsUploading() {
    return false
  }

}
