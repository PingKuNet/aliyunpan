import DebugLog from '@/utils/debuglog'
import message from '@/utils/message'
import fsPromises from 'fs/promises'
import { Buffer } from 'buffer'
import path from 'path'

export async function DoXiMa(dirPath: string, breakSmall: boolean, matchExtList: string[]): Promise<number> {
  const filelist: string[] = []
  await GetAllFiles(dirPath, breakSmall, filelist)
  if (filelist.length == 0) {
    message.error('选择的文件夹下找不到任何文件')
    return 0
  } else {
    let rand = Date.now()
    const rand1 = rand % 256
    rand = rand / 128
    const rand2 = Math.floor(rand % 256)
    let rand3 = Math.floor(Math.random() * 255)

    let RunCount = 0
    for (let i = 0, maxi = filelist.length; i < maxi; i++) {
      let file = filelist[i].toLowerCase().trimEnd()
      if (matchExtList.length > 0) {
        
        let find = false
        for (let j = 0; j < matchExtList.length; j++) {
          if (file.endsWith(matchExtList[j])) {
            find = true
            break
          }
        }
        if (find == false) continue 
      }
      try {
        const rand4 = (i % 255) + 1
        if (rand4 == 200) rand3 = Math.floor(Math.random() * 255)
        const buff = Buffer.from([0, rand1, rand2, rand3, rand4])
        fsPromises.appendFile(filelist[i], buff).catch((e: any) => {})
        RunCount++
      } catch (e: any) {
        DebugLog.mSaveLog('danger', 'XMappendFile' + (e.message || '') + filelist[i])
      }
    }
    return RunCount
  }
}

async function GetAllFiles(dir: string, breakSmall: boolean, filelist: string[]) {
  if (dir.endsWith(path.sep) == false) dir = dir + path.sep
  try {
    let childfiles = await fsPromises.readdir(dir).catch((e: any) => {
      if (e.code && e.code === 'EPERM') {
        e = '没有权限访问文件夹'
        message.error('没有权限访问文件夹：' + dir)
      }
      if (e.message) e = e.message
      if (typeof e == 'string' && e.indexOf('EACCES') >= 0) message.error('没有权限访问文件夹：' + dir)
      DebugLog.mSaveLog('danger', 'XMGetAllFiles文件失败：' + dir + ' ' + (e || ''))
      return []
    })

    let alltask: Promise<void>[] = []
    let dirlist: string[] = []
    for (let i = 0, maxi = childfiles.length; i < maxi; i++) {
      const name = childfiles[i] as string
      if (name.startsWith('.')) continue
      if (name.startsWith('#')) continue
      const item = dir + name
      alltask.push(
        fsPromises
          .lstat(item)
          .then((stat: any) => {
            if (stat.isDirectory()) dirlist.push(item)
            else if (stat.isSymbolicLink()) {
            } else if (stat.isFile()) {
              if (breakSmall == false || stat.size > 5 * 1024 * 1024) filelist.push(item)
            }
          })
          .catch()
      )
      if (alltask.length > 10) {
        await Promise.all(alltask).catch(() => {})
        alltask = []
      }
    }

    if (alltask.length > 0) {
      await Promise.all(alltask).catch(() => {})
      alltask = []
    }

    for (let i = 0, maxi = dirlist.length; i < maxi; i++) {
      await GetAllFiles(dirlist[i], breakSmall, filelist)
    }
  } catch (e: any) {
    DebugLog.mSaveLog('danger', 'GetAllFiles' + (e.message || ''))
  }

  return true
}
