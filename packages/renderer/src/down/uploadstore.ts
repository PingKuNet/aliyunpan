import { defineStore } from 'pinia'
import { IStateUploadFile } from '@/aliapi/models'
import { IAriaDownProgress } from './downdal'
//import sql from '@/store/sql'
import message from '@/utils/message'
import DB from '@/utils/db'

type Item = IStateUploadFile
type State = UploadState
const KEY = 'UploadID'

export interface UploadState {
  selectedFiles: Map<string, boolean>
  selectedFileLast: string
  changUploadingTime: object
  changUploadedTime: object
}

let SaveTime = 0;
let ChangUploadingTime = 0;
let ChangUploadedTime = 0;
export let UploadingList: IStateUploadFile[] = [];
export let UploadedList: IStateUploadFile[] = [];

const useUploadStore = defineStore('upload', {
  state: (): State => ({
    changUploadingTime: {},
    changUploadedTime: {},
    selectedFileLast: '',
    selectedFiles: new Map<string, boolean>()
  }),

  getters: {
    selectedUploadingCount: (state) =>  state.selectedFiles.size,
    uploadingCount: () => UploadingList.length,
    uploadedCount: () => UploadedList.length,
    selectedUploadingKey: (state) => [...state.selectedFiles.keys()],
    uploadingList: () => UploadingList,
    uploadedList: () => UploadedList
  },

  actions: {
    addUploading({ uploadinglist, tip }: { uploadinglist: IStateUploadFile[]; tip: boolean }) {
      const savelist = [];
      const haslist = new Map<string, boolean>();
      for (let i = 0; i < UploadingList.length; i++) {
        haslist.set(UploadingList[i].UploadID, true);
      }
      for (let d = 0; d < uploadinglist.length; d++) {
        let downitem = uploadinglist[d];
        if (haslist.has(downitem.UploadID) == false) {
          Object.freeze(downitem.Info);
          savelist.push(downitem);
        }
      }
      //sql.SaveUploadings(savelist);
      UploadingList.push(...savelist);
      ChangUploadingTime++;
      this.refreshUploadingList();
      if (tip) {
        message.success('成功创建 ' + savelist.length.toString() + '个上传任务');
      }
    },
    refreshUploadingList() {
      if (ChangUploadingTime == 0) return;
      this.changUploadingTime = { ts: Date.now() };
      ChangUploadingTime = 0;
    }

  }
})

export default useUploadStore
