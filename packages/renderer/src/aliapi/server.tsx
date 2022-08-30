import { B64decode, b64decode, b64encode } from '@/utils/format'
import axios, { AxiosResponse } from 'axios'
import Config from '@/utils/config'
import message from '@/utils/message'
import { IShareSiteModel, useServerStore } from '@/store'
import { Modal } from '@arco-design/web-vue'
import { h } from 'vue'
import { getAppNewPath, openExternal } from '@/utils/electronhelper'
import ShareDAL from '@/share/share/ShareDAL'
import DebugLog from '@/utils/debuglog'
import { writeFileSync, rmSync } from 'fs'

export interface IServerRespData {
  state: string
  msg: string
  [k: string]: any
}
export default class ServerHttp {
  static baseapi = b64decode('aHR0cDovLzEyMS41LjE0NC44NDo1MjgyLw==') 
  static async PostToServer(postdata: any): Promise<IServerRespData> {
    postdata.appVersion = Config.appVersion
    const str = JSON.stringify(postdata)
    if (window.postdataFunc) {
      let enstr = ''
      try {
        enstr = window.postdataFunc(str)
      } catch {
        return { state: 'error', msg: '联网失败' }
      }
      return ServerHttp.Post(enstr).catch(() => {
        return { state: 'error', msg: '网络错误' }
      })
    } else {
      return { state: 'error', msg: '程序错误' }
    }
  }

  static async Post(postdata: any, isfirst = true): Promise<IServerRespData> {
    const url = ServerHttp.baseapi + 'xby2'
    //const url = "http://192.168.31.74:2018/" + 'xby2'
    return axios
      .post(url, postdata, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {}
      })
      .then((response: AxiosResponse) => {
        if (response.status != 200) return { state: 'error', msg: '网络错误' }
        const buff = response.data as ArrayBuffer
        const uint8array = new Uint8Array(buff)
        for (let i = 0, maxi = uint8array.byteLength; i < maxi; i++) {
          uint8array[i] ^= 9 + (i % 200)
        }
        const str = new TextDecoder().decode(uint8array)
        return JSON.parse(str) as IServerRespData
      })
      .catch(() => {
        return { state: 'error', msg: '网络错误' }
      })
      .then((resp) => {
        if (resp.state == 'error' && resp.msg == '网络错误' && isfirst) {
          
          return ServerHttp.Sleep(2000).then(() => {
            return ServerHttp.Post(postdata, false) 
          })
        } else return resp
      })
  }
  static Sleep(msTime: number) {
    return new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            success: true,
            time: msTime
          }),
        msTime
      )
    )
  }

  //static configUrl = b64decode('aHR0cHM6Ly9naXRlZS5jb20vUGluZ0t1L2FsaXl1bnBhbi1jb25maWcvcmF3L2RldmVsb3AvY29uZmlnMy5qc29u')
  static configUrl = b64decode('aHR0cHM6Ly9naXRlZS5jb20vUGluZ0t1L2FsaXl1bnBhbi1jb25maWcvcmF3L21hc3Rlci9jb25maWczLmpzb24=')

  static showVer = false
  
  static async CheckUpgrade(showUpgred: boolean) {
    axios
      .get(ServerHttp.configUrl, {
        withCredentials: false,
        responseType: 'json',
        timeout: 30000
      })
      .then(async (response: AxiosResponse) => {
        console.log('CheckUpgrade', showUpgred, response)
        if (response.data.SIP) {
          const SIP = B64decode(response.data.SIP)
          if (SIP.length > 0) ServerHttp.baseapi = SIP
        }
        if (response.data.SSList) {
          const list: IShareSiteModel[] = []
          for (let i = 0, maxi = response.data.SSList.length; i < maxi; i++) {
            const item = response.data.SSList[i]
            const add = { title: item.title, url: item.url, tip: item.tip }
            if (add.url.length > 0) list.push(add)
          }
          ShareDAL.SaveShareSite(list)
        }
        if (response.data.HELP) {
          useServerStore().mSaveHelpUrl(response.data.HELP)
        }
        if (showUpgred && response.data.ExeVer) {
          const v1 = Config.appVersion.replaceAll('v', '').replaceAll('.', '').trim()
          const v2 = response.data.ExeVer.replaceAll('v', '').replaceAll('.', '').trim()
          const info = response.data.VerInfo as string
          const verurl = response.data.VerUrl || ''
          const appnewurl = response.data.AppNewUrl || ''

          const v1Int = parseInt(v1), v2Int = parseInt(v2)
          if (v2Int > v1Int) {
            if (appnewurl) {
              message.info('检测到新版本 ' + response.data.ExeVer)
              let isdown = await this.AutoDownload(B64decode(appnewurl))
              if (isdown) return 
            }

            if (!ServerHttp.showVer) {
              ServerHttp.showVer = true 

              Modal.confirm({
                okText: '确认',
                cancelText: '取消',
                title: () => h('div', { innerHTML: '有新版可以升级<span class="vertip">' + response.data.ExeVer + '</span><i class="verupdate"></i>', class: { vermodalhead: true }, style: { minWidth: '540px' } }),
                mask: true,
                maskClosable: false,
                escToClose: false,
                alignCenter: true,
                simple: true,
                onOk: () => {
                  if (verurl.length > 0) openExternal(B64decode(verurl))
                },
                onClose: () => {
                  ServerHttp.showVer = false
                },
                content: () => h('div', { innerHTML: info, class: { vermodal: true }, style: { minWidth: '540px' } })
              })
            }
          } else if (v2Int == v1Int) {
            message.info('已经是最新版 ' + response.data.ExeVer + '新版本发布一般在周六/周日晚上8-10点', 6)
          } else if (v2Int < v1Int) {
            message.info('您的本地版本 ' + Config.appVersion + ' 已高于服务器版本 ' + response.data.ExeVer, 6)
          }
        }
      })
      .catch((e: any) => {
        DebugLog.mSaveLog('danger', e.message)
      })
  }

  static async AutoDownload(appnewurl: string): Promise<boolean> {
    const appnew = getAppNewPath()
    return axios
      .get(appnewurl, {
        withCredentials: false,
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Expires: '0'
        }
      })
      .then((response: AxiosResponse) => {
        writeFileSync(appnew, Buffer.from(response.data))
        return true
      })
      .catch((e) => {
        rmSync(appnew, { force: true })
        return false
      })
  }
}




