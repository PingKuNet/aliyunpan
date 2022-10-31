import fuzzysort from 'fuzzysort'
import { defineStore } from 'pinia'
import { IStateDownFile } from './DownDAL'
import { GetSelectedList, GetFocusNext, SelectAll, MouseSelectOne, KeyboardSelectOne } from '../utils/selecthelper'
import { humanSize } from '../utils/format'
import message from '../utils/message'
import DB from '../utils/db'
import fs from 'fs'
import path from 'path'

type Item = IStateDownFile
type State = DownState
const KEY = 'DownID'

export interface DownState {

  ListLoading: boolean

  ListDataRaw: Item[]

  ListDataShow: Item[]

  ListSelected: Set<string>

  ListOrderKey: string

  ListFocusKey: string

  ListSelectKey: string

  ListSearchKey: string
}

const useDownStore = defineStore('down', {
  state: (): State => ({
    ListLoading: false,
    ListDataRaw: [],
    ListDataShow: [],
    ListSelected: new Set<string>(),
    ListOrderKey: 'DownID',
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
        if (item.Down.IsDowning) stats.runningCount++
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
      const data = MouseSelectOne(this.ListDataShow, KEY, this.ListSelected, this.ListFocusKey, this.ListSelectKey, key, Ctrl, Shift, '')
      this.$patch({ ListSelected: data.selectedNew, ListFocusKey: data.focusLast, ListSelectKey: data.selectedLast })
      this.mRefreshListDataShow(false)
    },

    mKeyboardSelect(key: string, Ctrl: boolean, Shift: boolean) {
      if (this.ListDataShow.length == 0) return
      const data = KeyboardSelectOne(this.ListDataShow, KEY, this.ListSelected, this.ListFocusKey, this.ListSelectKey, key, Ctrl, Shift, '')
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
      return GetFocusNext(this.ListDataShow, KEY, this.ListFocusKey, position, '')
    },

    /**
     * 删除下载完成，修改为“待删除”状态，并从列表中删除 <br/>
     * @param uploadIDList
     */
    mDeleteUploaded(uploadIDList: string[]) {
      const UploadedList = this.ListDataRaw
      const newListSelected = new Set(this.ListSelected);
      const newList: Item[] = [];
      for (let j = 0; j < UploadedList.length; j++) {
        const downID = UploadedList[j].DownID;
        if (uploadIDList.includes(downID)) {
          UploadedList[j].Down.DownState = '待删除'
          if (newListSelected.has(downID)) newListSelected.delete(downID);
        } else {
          newList.push(UploadedList[j]);
        }
      }
      this.ListDataRaw = newList;
      this.ListSelected = newListSelected;
      DB.deleteDowneds(uploadIDList)
      this.mRefreshListDataShow(true)
    },

    /**
     * 删除全部
     */
    mDeleteAllUploaded() {
      this.ListSelected = new Set<string>()
      this.ListDataRaw.splice(0, this.ListDataRaw.length)
      DB.deleteDownedAll()
      this.mRefreshListDataShow(true)
    },

    /**
     * 打开下载完成的文件 <br/>
     * file 和 downIDList 二选一
     * @param file
     * @param downIDList
     * @param isDir 是否打开目录
     */
    mOpenUploadedFile(file: Item | null, downIDList: string[], isDir: boolean) {
      const DownedList = this.ListDataRaw

      const openDir = (localFilePath: string) => {
        try {
          if (fs.existsSync(localFilePath)) {
            window.Electron.shell.showItemInFolder(localFilePath)
          } else {
            message.error('文件夹可能已经被删除')
          }
        } catch {
        }
      }

      const openFile = (localFilePath: string) => {
        try {
          if (fs.existsSync(localFilePath)) {
            window.Electron.shell.openPath(localFilePath)
          } else {
            message.error('文件可能已经被删除')
          }
        } catch {
        }
      }

      if (file) {
        if (file.Info.ariaRemote) {
          message.error('远程下载不支持该操作')
          return
        }
        const localFilePath = path.join(file.Info.DownSavePath, file.Info.name)
        if (isDir) {
          openDir(localFilePath)
        } else {
          openFile(localFilePath)
        }
        return
      }

      let opDownIDList = downIDList;
      if (downIDList.length > 10) {
        message.info('选择的数量大于10个，已经为你优化打开前10个',10)
        opDownIDList = downIDList.slice(0,10)
      }
      for (let j = 0; j < DownedList.length; j++) {
        const downID = DownedList[j].DownID
        if (opDownIDList.includes(downID)) {
          if (DownedList[j].Info.ariaRemote) {
            message.error('远程下载不支持该操作')
            continue
          }
          const localFilePath = path.join(DownedList[j].Info.DownSavePath, DownedList[j].Info.name)
          if (isDir) {
            openDir(localFilePath)
          } else {
            openFile(localFilePath)
          }
        }
      }
    },

  }
})

export default useDownStore
