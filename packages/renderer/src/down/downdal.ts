import { IAliGetFileModel } from '@/aliapi/alimodels'

export interface IStateDownFile {
  DownID: string
  Info: IStateDownInfo

  Down: {

    DownState: string
    DownTime: number
    DownSize: number
    DownSpeed: number
    DownSpeedStr: string
    DownProcess: number
    IsStop: boolean
    IsDowning: boolean
    IsCompleted: boolean
    IsFailed: boolean
    FailedCode: number
    FailedMessage: string

    AutoTry: number

    DownUrl: string
  }
}
export interface IStateDownInfo {

  GID: string
  user_id: string

  DownSavePath: string
  ariaRemote: boolean

  file_id: string
  drive_id: string

  name: string

  size: number
  sizestr: string
  icon: string
  isDir: boolean

  sha1: string

  crc64: string
}


export interface IAriaDownProgress {
  gid: string
  status: string
  totalLength: string
  completedLength: string
  downloadSpeed: string
  errorCode: string
  errorMessage: string
}

export let DowningList = new Map<string, IStateDownFile>()
export let DownedList: IStateDownFile[] = []
export default class DownDAL {

  /**
   * 从DB中加载数据
   */
  static async aLoadFromDB() {}

  /**
   * 添加到下载动作
   * @param filelist
   * @param savepath
   * @param needPanPath
   * @param tip
   */
  static aAddDownload(filelist: IAliGetFileModel[], savepath: string, needPanPath: boolean, tip: boolean) {}

  /**
   * 速度事件动作
   */
  static async aSpeedEvent() {
  }

  /**
   * 速度事件方法
   */
  static mSpeedEvent(list: IAriaDownProgress[]) {}

  /**
   * 查询是否下载中
   */
  static QueryIsDowning() {
    return false
  }

  /**
   * ?查询选择的是否下载中？
   */
  static QuerySelectedIsDowning() {
    return false
  }
}
