// import { humanSize, guid } from '../utils/format'
// import AliFile from '../aliapi/file'
// import { IUploadCreat } from '../aliapi/models'
// import AliUpload from '../aliapi/upload'
// import AliUploadHash from '../aliapi/uploadhash'
// import DB from '../utils/db'
// import { IAriaDownProgress } from './DownDAL'
// import { IStateUploadFile } from '../aliapi/models'
// import { ITokenInfo } from '../user/userstore'
// import AliFileCmd from '../aliapi/filecmd'
// import UploadDAL from './UploadDAL'
// import fsPromises from 'fs/promises'
//
// const UploadList: IStateUploadFile[] = [];
//
// /**
//  * 上传事件
//  */
// export async function UploadEvent() {
//   const list: IAriaDownProgress[] = [];
//   for (let j = 0; j < UploadList.length; j++) {
//     const item = UploadList[j];
//     try {
//       if (item.Upload.FailedMessage.startsWith('计算sha1(')) {
//         const posnow = AliUploadHash.GetFileHashProofSpeed(item.UploadID);
//         let speed = posnow - item.Upload.DownSize;
//         item.Upload.DownSize = posnow;
//         if (speed < 0) speed = 0;
//         list.push({
//           gid: item.UploadID,
//           status: item.Upload.DownState,
//           totalLength: item.Info.size.toString(),
//           completedLength: '0',
//           downloadSpeed: '0',
//           errorCode: item.Upload.FailedCode.toString(),
//           errorMessage: item.Upload.FailedMessage + ' ' + humanSize(speed) + '/s',
//         });
//       } else if (item.Upload.DownState == '已暂停' || item.Upload.DownState == '待删除') {
//         UploadList.splice(j, 1)
//         j--;
//       } else {
//         const posnow = AliUpload.GetFileUploadProofSpeed(item.UploadID);
//         let speed = posnow - item.Upload.DownSize;
//         item.Upload.DownSize = posnow;
//         if (speed < 0) speed = 0;
//         list.push({
//           gid: item.UploadID,
//           status: item.Upload.DownState,
//           totalLength: item.Info.size.toString(),
//           completedLength: item.Upload.DownSize.toString(),
//           downloadSpeed: speed.toString(),
//           errorCode: item.Upload.FailedCode.toString(),
//           errorMessage: item.Upload.FailedMessage,
//         });
//       }
//     } catch {}
//   }
//
//   UploadDAL.aUploadEvent(list)
//   //if (window.WinMsgToMain) window.WinMsgToMain({ cmd: 'MainUploadEvent', list }); // 发送到主进程执行上传
// }
//
// /**
//  * 添加到上传
//  * @param uploadList
//  * @constructor
//  */
// export function UploadAdd(uploadList: IStateUploadFile[]) {
//
//   for (let i = 0; i < uploadList.length; i++) {
//     const item = uploadList[i];
//     let find = false;
//     for (let j = 0; j < UploadList.length; j++) {
//       if (item.UploadID == UploadList[j].UploadID) {
//         find = true;
//         /* TODO PingKu:已经正在执行上传中的就 **不要外部更改上传状态** 了，除非要重新执行上传处理，
//             但我认为更合理的处理方法是内部做重试，或者从执行列表中移除再添加
//             再或者是使用 ReStartUpload 方法做单独处理，防止重复的执行上传处理
//          */
//         if (item.Upload.DownState != '解析中' && item.Upload.DownState.indexOf('%') < 0) {
//           item.Upload.DownState = '解析中';
//           StartUpload(item);
//         }
//         break;
//       }
//     }
//     if (!find) {
//       item.Upload.DownState = '解析中'
//       UploadList.push(item);
//       StartUpload(item);
//     }
//   }
// }
//
// export function UploadCmd(uploadAll: boolean, uploadCmd: string, uploadIDList: string[]) {
//   for (let j = 0; j < UploadList.length; j++) {
//     const UploadID = UploadList[j].UploadID;
//     if (uploadAll || uploadIDList.includes(UploadID)) {
//       if (uploadCmd == 'stop') {
//         // TODO if 和 else 有区别吗？
//         if (UploadList[j].Upload.DownState == '解析中' || UploadList[j].Upload.DownState.indexOf('%') > -1)
//           StopUpload(UploadList[j], false);
//         else
//           UploadList[j].Upload.DownState = '已暂停';
//       } else if (uploadCmd == 'delete') {
//         if (UploadList[j].Upload.DownState == '解析中' || UploadList[j].Upload.DownState.indexOf('%') > -1)
//           StopUpload(UploadList[j], true);
//         else
//           UploadList[j].Upload.DownState = '待删除';
//       }
//     }
//   }
// }
//
// function StopUpload(item: IStateUploadFile, isDelete: boolean) {
//   item.Upload.DownState = '已暂停'
//   if (isDelete) item.Upload.DownState = '待删除'
// }
//
// /**
//  * 重新上传Url
//  * @param uploadinfo
//  * @param item
//  * @param token TODO PingKu:后面要改成只传 user_id
//  */
// async function reloadUploadUrl(uploadinfo: IUploadCreat, item: IStateUploadFile, token: ITokenInfo) {
//   uploadinfo.file_id = item.Upload.file_id;
//   uploadinfo.upload_id = item.Upload.upload_id;
//   uploadinfo.part_info_list = [];
//   await AliUpload.UploadFilePartUrl(token.user_id, item.Info.drive_id, item.Upload.file_id, item.Upload.upload_id, item.Info.size, uploadinfo);
//   if (uploadinfo.part_info_list.length > 0) {
//     await AliUpload.UploadFileListUploadedParts(token.user_id, item.Info.drive_id, item.Upload.file_id, item.Upload.upload_id, 0, uploadinfo);
//     let isupload = true;
//     for (let i = 0; i < uploadinfo.part_info_list.length; i++) {
//       if (isupload && uploadinfo.part_info_list[i].isupload == false) {
//         isupload = false;
//       }
//       if (isupload === false && uploadinfo.part_info_list[i].isupload == true) uploadinfo.part_info_list[i].isupload = false;
//     }
//   } else {
//     uploadinfo.upload_id = '';
//     uploadinfo.file_id = '';
//   }
// }
//
// /**
//  * 检查 PreHash 和取得 Partlist
//  * @param uploadinfo
//  * @param item
//  * @param token TODO PingKu:后面要改成只传 user_id
//  */
// async function checkPreHashAndGetPartlist(uploadinfo: IUploadCreat, item: IStateUploadFile, token: ITokenInfo) {
//   let PreHashMatched = true;
//   if (item.Info.size >= 1024000) {
//     const prehash = await AliUploadHash.GetFilePreHash(item.Info.localFilePath);
//     const Matched = await AliUpload.UploadCreatFileWithFolders(token.user_id, item.Info.drive_id, item.Info.parent_id,
//       item.Info.name, item.Info.size, '', '', prehash, item.Upload.IsBreakExist);
//     PreHashMatched = Matched.errormsg == 'PreHashMatched';
//     if (Matched.errormsg == '') {
//       item.Upload.upload_id = Matched.upload_id;
//       item.Upload.file_id = Matched.file_id;
//       uploadinfo.file_id = Matched.file_id;
//       uploadinfo.upload_id = Matched.upload_id;
//       uploadinfo.part_info_list = Matched.part_info_list;
//       uploadinfo.errormsg = '';
//       uploadinfo.israpid = false;
//     }
//   }
//   if (PreHashMatched) { // PreHash 匹配成功再使用 HashProof 匹配一次
//     const proof = await AliUploadHash.GetFileHashProof(token.access_token, item);
//     if (item.Upload.DownState !== '解析中') {
//       item.Upload.FailedCode = 0;
//       item.Upload.FailedMessage = '';
//       return true;
//     }
//     if (proof.sha1 == 'error') {
//       item.Upload.DownState = '已出错';
//       item.Upload.FailedCode = 503;
//       item.Upload.FailedMessage = '计算sha1出错可能文件拒绝访问';
//       return true;
//     } else {
//       item.Upload.DownState = '上传中'
//       const MiaoChuan = await AliUpload.UploadCreatFileWithFolders(token.user_id, item.Info.drive_id, item.Info.parent_id,
//         item.Info.name, item.Info.size, proof.sha1, proof.proof_code, '', item.Upload.IsBreakExist);
//       if (MiaoChuan.israpid) {
//         item.Upload.IsCompleted = true
//         item.Upload.DownState = '已完成'
//         return true;
//       } else if (MiaoChuan.errormsg != '') {
//         item.Upload.DownState = '已出错';
//         item.Upload.FailedCode = 504;
//         item.Upload.FailedMessage = MiaoChuan.errormsg;
//         return true;
//       } else {
//         item.Upload.upload_id = MiaoChuan.upload_id;
//         item.Upload.file_id = MiaoChuan.file_id;
//         uploadinfo.file_id = MiaoChuan.file_id;
//         uploadinfo.upload_id = MiaoChuan.upload_id;
//         uploadinfo.part_info_list = MiaoChuan.part_info_list;
//         uploadinfo.errormsg = '';
//         uploadinfo.israpid = false;
//         return false;
//       }
//     }
//   }
// }
//
// /**
//  * 启动一个上传任务
//  * @param item
//  * @constructor
//  */
// async function StartUpload(item: IStateUploadFile) {
//   const token = await DB.getUser(item.Info.user_id);
//   if (token == undefined || token.user_id !== item.Info.user_id) {
//     item.Upload.DownState = '已出错';
//     item.Upload.FailedCode = 401;
//     item.Upload.FailedMessage = '找不到账号,无法继续';
//     return;
//   }
//   const name = item.Info.path == '' ? item.Info.name : item.Info.path + '/' + item.Info.name;
//   if (item.Info.isDir) {
//     const result = await AliFileCmd.ApiCreatNewForder(item.Info.user_id, item.Info.drive_id, item.Info.parent_id, name);
//     if (result != undefined && result != 'QuotaExhausted.Drive') {
//       //if (item.Info.isMiaoChuan == false && window.WinMsgToMain) window.WinMsgToMain({ cmd: 'MainUploadDir', Info: item.Info, parentid: result });
//       const parentid = result as string
//       const Info = item.Info
//       UploadDAL.UploadLocalDir(Info.user_id, Info.drive_id, parentid, Info.localFilePath)
//       item.Upload.DownState = '已完成';
//     } else {
//       item.Upload.DownState = '已出错';
//       item.Upload.FailedCode = 402;
//       item.Upload.FailedMessage = '创建文件夹失败:' + name;
//       if (result == 'QuotaExhausted.Drive') item.Upload.FailedMessage = '创建文件夹失败：网盘空间已满';
//     }
//     return;
//   }
//
//   if (item.Info.isMiaoChuan) {
//     const result = await AliUpload.UploadCreatFile(token.user_id, item.Info.drive_id, item.Info.parent_id, name,
//       item.Info.size, item.Info.sha1, '');
//     if (result.israpid) {
//       item.Upload.DownState = '已完成';
//     } else {
//       item.Upload.DownState = '已出错';
//       item.Upload.FailedCode = 402;
//       item.Upload.FailedMessage = '秒传失败,' + (result.errormsg == '' ? '云盘中不存在此sha1的相同文件' : result.errormsg);
//     }
//     return;
//   }
//
//   const stat = await fsPromises.lstat(item.Info.localFilePath).catch(() => {
//     return undefined;
//   });
//   if (!stat) {
//     item.Upload.DownState = '已出错';
//     item.Upload.FailedCode = 402;
//     item.Upload.FailedMessage = '读取文件大小失败可能已删除';
//     return;
//   }
//
//   if (item.Info.size != stat.size) {
//     item.Info.size = stat.size;
//     item.Info.sizestr = humanSize(stat.size);
//     item.Info.sha1 = '';
//     item.Upload.upload_id = '';
//   }
//
//   const uploadinfo: IUploadCreat = {
//     user_id: '',
//     drive_id: '',
//     file_id: '',
//     israpid: false,
//     isexist: false,
//     upload_id: '',
//     part_info_list: [],
//     errormsg: ''
//   };
//   if (item.Upload.upload_id != '' && item.Upload.file_id != '') {
//     await reloadUploadUrl(uploadinfo, item, token);
//   }
//   if (uploadinfo.upload_id == '') {
//     const PreHashMatched = await checkPreHashAndGetPartlist(uploadinfo, item, token);
//     if (PreHashMatched) return;
//   }
//   if (uploadinfo.part_info_list.length == 0) {
//     item.Upload.DownState = '已出错';
//     item.Upload.FailedCode = 505;
//     item.Upload.FailedMessage = '获取上传地址失败1';
//     return;
//   }
//   if (uploadinfo.part_info_list.length > 1)
//     UploadDAL.mSaveToUploading(item.UploadID, uploadinfo.file_id, uploadinfo.upload_id)
//   //if (uploadinfo.part_info_list.length > 1 && window.WinMsgToMain) window.WinMsgToMain({ cmd: 'MainUploadID', UploadID: item.UploadID, file_id: uploadinfo.file_id, upload_id: uploadinfo.upload_id });
//
//
//   item.Upload.DownState = '上传中';
//   const UpResult = await AliUpload.UploadOneFile(token.user_id, uploadinfo, item);
//
//   if (UpResult == 'success') item.Upload.DownState = '已完成';
//   else if (item.Upload.DownState == '解析中') {
//     item.Upload.DownState = '已出错';
//     item.Upload.FailedCode = 505;
//     item.Upload.FailedMessage = UpResult;
//   }
// }
