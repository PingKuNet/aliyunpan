import fuzzysort from 'fuzzysort'
import { defineStore } from 'pinia'
import { IStateUploadFile } from '@/aliapi/models'
import { GetSelectedList, GetFocusNext, SelectAll, MouseSelectOne, KeyboardSelectOne } from '@/utils/selecthelper'
import { humanSize } from '@/utils/format'
import message from '@/utils/message'
import DB from '@/utils/db'
import { UploadCmd } from '@/down/uploadservice'

type Item = IStateUploadFile
type State = UploadingState
const KEY = 'UploadID'

export interface UploadingState {

  ListLoading: boolean

  ListDataRaw: Item[]

  ListDataShow: Item[]

  ListSelected: Set<string>

  ListOrderKey: string

  ListFocusKey: string

  ListSelectKey: string

  ListSearchKey: string
}

const useUploadingStore = defineStore('uploading', {
  state: (): State => ({
    ListLoading: false,
    ListDataRaw: [],
    ListDataShow: [],
    ListSelected: new Set<string>(),
    ListOrderKey: 'UploadID',
    ListFocusKey: '',
    ListSelectKey: '',
    ListSearchKey: ''
  }),

  getters: {
    ListDataCount(state: State): number {
      return state.ListDataShow.length
    },

    IsListSelected(state: State): boolean {
      return state.ListSelected.size > 0
    },

    ListSelectedCount(state: State): number {
      return state.ListSelected.size
    },

    ListDataSelectCountInfo(state: State): string {
      return '已选中 ' + state.ListSelected.size + ' / ' + state.ListDataShow.length + ' 个'
    },

    IsListSelectedAll(state: State): boolean {
      return state.ListSelected.size > 0 && state.ListSelected.size == state.ListDataShow.length
    },

    ListStats(state: State) {
      let stats = { count: 0, runningCount: 0, totalSize: 0, totalSizeStr: '' }
      let list = state.ListDataShow
      let item: Item
      for (let i = 0, maxi = list.length; i < maxi; i++) {
        item = list[i]
        stats.count++
        stats.totalSize += item.Info.size
        if (item.Upload.IsDowning) stats.runningCount++
      }
      stats.totalSizeStr = humanSize(stats.totalSize)
      return stats
    }
  },

  actions: {

    aLoadListData(list: Item[]) {

      let item: Item
      for (let i = 0, maxi = list.length; i < maxi; i++) {
        item = list[i]
      }
      this.ListDataRaw = this.mGetOrder(this.ListOrderKey, list)

      let oldSelected = this.ListSelected
      let newSelected = new Set<string>()
      let key = ''
      for (let i = 0, maxi = list.length; i < maxi; i++) {
        key = list[i][KEY]
        if (oldSelected.has(key)) newSelected.add(key)
      }

      this.$patch({ ListSelected: newSelected, ListFocusKey: '', ListSelectKey: '', ListSearchKey: '' })
      this.mRefreshListDataShow(true)
    },

    mSearchListData(value: string) {
      this.$patch({ ListSelected: new Set<string>(), ListFocusKey: '', ListSelectKey: '', ListSearchKey: value })
      this.mRefreshListDataShow(true)
    },

    mOrderListData(value: string) {
      this.$patch({ ListOrderKey: value, ListSelected: new Set<string>(), ListFocusKey: '', ListSelectKey: '' })
      this.ListDataRaw = this.mGetOrder(value, this.ListDataRaw)
      this.mRefreshListDataShow(true)
    },

    mGetOrder(order: string, list: Item[]) {
      return list
    },

    /**
     * 刷新显示的列表数据
     * @param refreshRaw 是否从原始数据中刷新显示
     */
    mRefreshListDataShow(refreshRaw: boolean) {
      if (!refreshRaw) {
        let ListDataShow = this.ListDataShow.concat()
        Object.freeze(ListDataShow)
        this.ListDataShow = ListDataShow
        return
      }
      if (this.ListSearchKey) {

        let searchlist: Item[] = []
        let results = fuzzysort.go(this.ListSearchKey, this.ListDataRaw, {
          threshold: -200000,
          keys: ['Info.name'],
          scoreFn: (a) => Math.max(a[0] ? a[0].score : -200000, a[1] ? a[1].score : -200000)
        })
        for (let i = 0, maxi = results.length; i < maxi; i++) {
          if (results[i].score > -200000) searchlist.push(results[i].obj as Item)
        }
        Object.freeze(searchlist)
        this.ListDataShow = searchlist
      } else {

        let ListDataShow = this.ListDataRaw.concat()
        Object.freeze(ListDataShow)
        this.ListDataShow = ListDataShow
      }

      let freezelist = this.ListDataShow
      let oldSelected = this.ListSelected
      let newSelected = new Set<string>()
      let key = ''
      for (let i = 0, maxi = freezelist.length; i < maxi; i++) {
        key = freezelist[i][KEY]
        if (oldSelected.has(key)) newSelected.add(key)
      }
      this.ListSelected = newSelected
    },

    mSelectAll() {
      this.$patch({ ListSelected: SelectAll(this.ListDataShow, KEY, this.ListSelected), ListFocusKey: '', ListSelectKey: '' })
      this.mRefreshListDataShow(false)
    },

    mMouseSelect(key: string, Ctrl: boolean, Shift: boolean) {
      if (this.ListDataShow.length == 0) return
      const data = MouseSelectOne(this.ListDataShow, KEY, this.ListSelected, this.ListFocusKey, this.ListSelectKey, key, Ctrl, Shift)
      this.$patch({ ListSelected: data.selectedNew, ListFocusKey: data.focusLast, ListSelectKey: data.selectedLast })
      this.mRefreshListDataShow(false)
    },

    mKeyboardSelect(key: string, Ctrl: boolean, Shift: boolean) {
      if (this.ListDataShow.length == 0) return
      const data = KeyboardSelectOne(this.ListDataShow, KEY, this.ListSelected, this.ListFocusKey, this.ListSelectKey, key, Ctrl, Shift)
      this.$patch({ ListSelected: data.selectedNew, ListFocusKey: data.focusLast, ListSelectKey: data.selectedLast })
      this.mRefreshListDataShow(false)
    },

    GetSelected() {
      return GetSelectedList(this.ListDataShow, KEY, this.ListSelected)
    },

    GetSelectedFirst() {
      let list = GetSelectedList(this.ListDataShow, KEY, this.ListSelected)
      if (list.length > 0) return list[0]
      return undefined
    },

    mSetFocus(key: string) {
      this.ListFocusKey = key
      this.mRefreshListDataShow(false)
    },

    mGetFocus() {
      if (this.ListFocusKey == '' && this.ListDataShow.length > 0) return this.ListDataShow[0][KEY]
      return this.ListFocusKey
    },

    mGetFocusNext(position: string) {
      return GetFocusNext(this.ListDataShow, KEY, this.ListFocusKey, position)
    },

    mDeleteFiles(shareidlist: string[]) {
      let filemap = new Set(shareidlist)
      let ListDataRaw = this.ListDataRaw
      let NewDataList: Item[] = []
      for (let i = 0, maxi = ListDataRaw.length; i < maxi; i++) {
        let item = ListDataRaw[i]
        if (!filemap.has(item[KEY])) {
          NewDataList.push(item)
        }
      }
      if (this.ListDataRaw.length != NewDataList.length) {
        this.ListDataRaw = NewDataList
        this.mRefreshListDataShow(true)
      }
    },

    mAddUploading({ uploadinglist, tip }: { uploadinglist: IStateUploadFile[]; tip: boolean }) {
      const savelist = [];
      const haslist = new Map<string, boolean>();
      for (let i = 0; i < this.ListDataRaw.length; i++) {
        haslist.set(this.ListDataRaw[i].UploadID, true);
      }
      for (let d = 0; d < uploadinglist.length; d++) {
        const downitem = uploadinglist[d];
        if (!haslist.has(downitem.UploadID)) {
          Object.freeze(downitem.Info);
          savelist.push(downitem);
          DB.saveUploading(downitem.UploadID, downitem);
        }
      }
      this.ListDataRaw.push(...savelist);
      this.mRefreshListDataShow(true)
      if (tip) {
        message.success('成功创建 ' + savelist.length.toString() + '个上传任务');
      }
    },

    /**
     * 开始上传，只改变状态，待定时任务处理
     */
    mStartUploading() {
      const UploadingList = this.ListDataRaw
      for (const UploadID of this.ListSelected) {
        for (let j = 0; j < UploadingList.length; j++) {
          if (UploadingList[j].UploadID == UploadID) {
            const down = UploadingList[j].Upload;
            if (down.IsDowning || down.IsCompleted) continue;
            down.IsStop = false;
            down.DownState = '队列中';
            down.DownSpeed = 0;
            down.DownSpeedStr = '';
            down.IsFailed = false;
            down.FailedCode = 0;
            down.FailedMessage = '';
            down.AutoTry = 0;
            break;
          }
        }
      }
    },

    /**
     * 开始全部
     */
    mStartAllUploading() {
      const UploadingList = this.ListDataRaw
      for (let j = 0; j < UploadingList.length; j++) {
        const down = UploadingList[j].Upload;
        if (down.IsDowning || down.IsCompleted) continue;
        down.IsStop = false;
        down.DownState = '队列中';
        down.DownSpeed = 0;
        down.DownSpeedStr = '';
        down.IsFailed = false;
        down.FailedCode = 0;
        down.FailedMessage = '';
        down.AutoTry = 0;
      }
    },

    /**
     * 暂停上传，只改变状态，待定时任务处理
     */
    mStopUploading() {
      const uploadIDList: string[] = [];
      const UploadingList = this.ListDataRaw
      for (const UploadID of this.ListSelected) {
        for (let j = 0; j < UploadingList.length; j++) {
          if (UploadingList[j].UploadID == UploadID) {
            const down = UploadingList[j].Upload;
            if (down.IsCompleted) continue;
            uploadIDList.push(UploadingList[j].UploadID);
            down.IsDowning = false;
            down.IsCompleted = false;
            down.IsStop = true;
            down.DownState = '已暂停';
            down.DownSpeed = 0;
            down.DownSpeedStr = '';
            down.IsFailed = false;
            down.FailedCode = 0;
            down.FailedMessage = '';
            down.AutoTry = 0;
            break;
          }
        }
      }
      UploadCmd(false, 'stop', uploadIDList)
      // if (window.WinMsgToUI) window.WinMsgToUI({ cmd: 'UploadCmd', uploadCmd: 'stop', uploadAll: false, uploadIDList });
      this.mRefreshListDataShow(true)
    },

    /**
     * 暂停全部
     */
    mStopAllUploading() {
      const uploadIDList: string[] = [];
      const UploadingList = this.ListDataRaw
      for (let j = 0; j < UploadingList.length; j++) {
        const down = UploadingList[j].Upload;
        if (down.IsCompleted) continue;
        uploadIDList.push(UploadingList[j].UploadID);
        down.IsDowning = false;
        down.IsStop = true;
        down.DownState = '已暂停';
        down.DownSpeed = 0;
        down.DownSpeedStr = '';
        down.IsFailed = false;
        down.FailedCode = 0;
        down.FailedMessage = '';
        down.AutoTry = 0;
      }
      UploadCmd(false, 'stop', uploadIDList)
      // if (window.WinMsgToUI) window.WinMsgToUI({ cmd: 'UploadCmd', uploadCmd: 'stop', uploadAll: true, uploadIDList });
      this.mRefreshListDataShow(true)
    },

    /**
     * 删除上传，修改为“待删除”状态，并从列表中删除 <br/>
     * 注：上传服务中的执行列表，请根据状态做进一步处理
     * @param uploadIDList
     */
    mDeleteUploading(uploadIDList: string[]) {
      const UploadingList = this.ListDataRaw
      const newListSelected = new Set(this.ListSelected);
      const newList: IStateUploadFile[] = [];
      for (let j = 0; j < UploadingList.length; j++) {
        const UploadID = UploadingList[j].UploadID;
        if (uploadIDList.includes(UploadID)) {
          UploadingList[j].Upload.DownState = '待删除'
          if (newListSelected.has(UploadID)) newListSelected.delete(UploadID);
        } else {
          newList.push(UploadingList[j]);
        }
      }
      this.ListDataRaw = newList;
      this.ListSelected = newListSelected;
      DB.deleteUploadings(uploadIDList)
      this.mRefreshListDataShow(true)
      UploadCmd(false, 'delete', uploadIDList)
      // if (window.WinMsgToUI) window.WinMsgToUI({ cmd: 'UploadCmd', uploadCmd: 'delete', uploadAll: false, uploadIDList });
    },

    /**
     * 删除全部，修改为“待删除”状态，并从列表中删除 <br/>
     * 注：上传服务中的执行列表，请根据状态做进一步处理
     */
    mDeleteAllUploading() {
      const UploadingList = this.ListDataRaw
      this.ListSelected = new Set<string>()
      const uploadIDList: string[] = []
      for (let j = 0; j < UploadingList.length; j++) {
        const UploadID = UploadingList[j].UploadID
        uploadIDList.push(UploadID)
      }
      UploadingList.splice(0, UploadingList.length)
      DB.deleteUploadingAll()
      this.mRefreshListDataShow(true)
      UploadCmd(false, 'delete', uploadIDList)
      // if (window.WinMsgToUI) window.WinMsgToUI({ cmd: 'UploadCmd', uploadCmd: 'delete', uploadAll: true, uploadIDList });
    },

    /**
     * 排序
     * @param uploadIDList 要放在前面的上传ID
     */
    mOrderUploading(uploadIDList: string[]) {
      const UploadingList = this.ListDataRaw
      const newlist: IStateUploadFile[] = [];
      const lastlist: IStateUploadFile[] = [];

      for (let j = 0; j < UploadingList.length; j++) {
        const UploadID = UploadingList[j].UploadID;
        let find = false;
        for (let i = 0; i < uploadIDList.length; i++) {
          if (uploadIDList[i] == UploadID) {
            newlist.push(UploadingList[j]);
            find = true;
            break;
          }
        }
        if (!find) {
          lastlist.push(UploadingList[j]);
        }
      }
      UploadingList.splice(0, UploadingList.length, ...newlist, ...lastlist);
      this.mRefreshListDataShow(true)
    },

    /**
     * 保存到历史中，并从列表中删除
     * @param UploadID
     */
    mSaveToUploaded(UploadID: string) {
      const UploadingList = this.ListDataRaw
      for (let j = 0; j < UploadingList.length; j++) {
        if (UploadingList[j].UploadID == UploadID && UploadingList[j].Upload.DownState === '已完成') {
          const item = UploadingList[j];

          UploadingList.splice(j, 1);
          DB.deleteUploading(UploadID)

          item.Upload.DownTime = Date.now();
          item.UploadID = item.UploadID + '_' + item.Upload.DownTime.toString();
          // UploadedList.splice(0, 0, item); // TODO 更新页面中的历史记录
          DB.saveUploaded(item.UploadID, item)

          break;
        }
      }
      if (this.ListSelected.has(UploadID)) this.ListSelected.delete(UploadID)
    },

    /**
     * 保存
     * @param UploadID
     * @param file_id
     * @param upload_id
     */
    mSaveToUploading({ UploadID, file_id, upload_id }: { UploadID: string; file_id: string; upload_id: string }) {
      const UploadingList = this.ListDataRaw
      for (let j = 0; j < UploadingList.length; j++) {
        if (UploadingList[j].UploadID == UploadID) {
          UploadingList[j].Upload.file_id = file_id;
          UploadingList[j].Upload.upload_id = upload_id;
          DB.saveUploading(UploadingList[j].UploadID, UploadingList[j])
          break;
        }
      }
    },

  }
})

export default useUploadingStore
