import { defineStore } from 'pinia'


export interface IShareSiteModel {
  title: string
  url: string
  tip: string
}

export interface ServerState {
  
  ShareSiteList: IShareSiteModel[]
  HelpUrl: string
}

const useServerStore = defineStore('serverstore', {
  state: (): ServerState => ({
    ShareSiteList: [],
    HelpUrl: 'aHR0cHM6Ly9naXRodWIuY29tL1BpbmdLdU5ldC9hbGl5dW5wYW4='
  }),
  actions: {
    
    mSaveShareSiteList(ShareSiteList: IShareSiteModel[]) {
      this.ShareSiteList = ShareSiteList || []
    },
    
    mSaveHelpUrl(url: string) {
      this.HelpUrl = url || 'aHR0cHM6Ly9naXRodWIuY29tL1BpbmdLdU5ldC9hbGl5dW5wYW4='
    }
  }
})

export default useServerStore
