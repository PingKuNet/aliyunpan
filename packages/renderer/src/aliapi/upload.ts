import UserDAL from '@/user/userdal'
import DebugLog from '@/utils/debuglog'
import AliHttp from './alihttp'
import { IStateUploadFile, IUploadCreat } from './models'
import AliUser from './user'
import { IsSuccess } from './utils'
import { FileHandle } from 'fs/promises'
import fsPromises from 'fs/promises'
import axios from 'axios';

const filelist: Map<string, number> = new Map();

export default class AliUpload {

  static async UploadCreatFile(user_id: string, drive_id: string, parentid: string, name: string, size: number, hash: string, prehash: string): Promise<IUploadCreat> {
    //const url = 'https://api.aliyundrive.com/adrive/v2/file/createWithFolders';
    const url = 'v2/file/create';
    const postdata: {
      drive_id: string;
      parent_file_id: string;
      name: string;
      type: string;
      check_name_mode: string;
      size: number;
      content_hash?: string;
      content_hash_name?: string;
      proof_code?: string;
      proof_version?: string;
      pre_hash?: string;
    } = {
      drive_id,
      parent_file_id: parentid,
      name,
      type: 'file',
      check_name_mode: 'refuse',
      size,
    };

    if (hash != '') {
      postdata.content_hash = hash.toUpperCase();
      postdata.content_hash_name = 'sha1';
    } else {
      postdata.pre_hash = prehash;
    }
    const resp = await AliHttp.Post(url, postdata, user_id, '');
    const result: IUploadCreat = {
      user_id: user_id,
      drive_id: '',
      file_id: '',
      israpid: false,
      isexist: false,
      upload_id: '',
      part_info_list: [],
      errormsg: '',
    };

    if (typeof resp.body === 'object' && JSON.stringify(resp.body).indexOf('file size is exceed') > 0) {
      result.errormsg = '创建文件失败(单文件最大2TB)';
      return result;
    }
    if (resp.body.code && resp.body.code == 'PreHashMatched') {
      result.errormsg = 'PreHashMatched';
      return result;
    }
    if (resp.body.code && resp.body.code == 'QuotaExhausted.Drive') {
      result.errormsg = '网盘空间已满保存文件失败';
      return result;
    }
    if (IsSuccess(resp.code)) {
      result.file_id = resp.body.file_id;

      if (resp.body.exist) {
        const issame = await AliUpload.UploadFileCheckHash(user_id, drive_id, result.file_id, hash);
        if (!issame) {
          await AliUpload.UploadFileDelete(user_id, drive_id, result.file_id);
          return await AliUpload.UploadCreatFile(user_id, drive_id, parentid, name, size, hash, prehash);
        }
      }
      result.israpid = resp.body.rapid_upload || resp.body.exist || false;
      result.upload_id = resp.body.upload_id || '';
      if (resp.body.part_info_list && resp.body.part_info_list.length > 0) {
        for (let i = 0; i < resp.body.part_info_list.length; i++) {
          const item = resp.body.part_info_list[i];
          result.part_info_list.push({ upload_url: item.upload_url, part_number: item.part_number,
            part_size: item.part_size, isupload: false });
        }
      }
      return result;
    } else {
      result.errormsg = '创建文件失败' + resp.code.toString();
      return result;
    }
  }

  /**
   * 上传时创建文件与文件夹
   * @param user_id 用户ID
   * @param drive_id 网盘ID
   * @param parentid 父目录ID
   * @param name 名称
   * @param filesize 文件大小
   * @param hash 哈希值
   * @param proof_code
   * @param prehash
   * @param IsBreakExist 是否覆盖
   */
  static async UploadCreatFileWithFolders(user_id: string, drive_id: string, parentid: string, name: string, filesize: number, hash: string, proof_code: string, prehash: string, IsBreakExist: boolean): Promise<IUploadCreat> {
    const url = 'adrive/v2/file/createWithFolders'
    const postdata: {
      drive_id: string
      parent_file_id: string
      name: string
      type: string
      check_name_mode: string
      size: number
      content_hash?: string
      content_hash_name?: string
      proof_code?: string
      proof_version?: string
      pre_hash?: string
      part_info_list: { part_number: number; part_size: number }[]
    } = {
      drive_id: drive_id,
      parent_file_id: parentid,
      name: name,
      type: 'file',
      check_name_mode: 'refuse',
      size: filesize,
      part_info_list: []
    }

    if (hash) {
      postdata.content_hash = hash.toUpperCase()
      postdata.content_hash_name = 'sha1'
      postdata.proof_version = 'v1'
      postdata.proof_code = proof_code

    } else {
      hash = ''
      postdata.pre_hash = prehash
    }

    let partsize = 10485760
    if (filesize > 0) {
      let partindex = 0

      while (filesize > partsize * 8000) partsize = partsize + 10485760

      while (partindex * partsize < filesize) {
        postdata.part_info_list.push({ part_number: partindex + 1, part_size: partsize })
        partindex++
      }
      postdata.part_info_list[partindex - 1].part_size = filesize - (partindex - 1) * partsize
    }
    const resp = await AliHttp.Post(url, postdata, user_id, '')
    const result: IUploadCreat = {
      user_id,
      drive_id,
      israpid: false,
      isexist: false,
      upload_id: '',
      file_id: '',
      part_info_list: [],
      errormsg: ''
    }

    if (typeof resp.body === 'object' && JSON.stringify(resp.body).indexOf('file size is exceed') > 0) {
      result.errormsg = '创建文件失败(单文件最大2TB)'
      return result
    }

    if (resp.body && resp.body.code) {
      if (resp.body?.code == 'PreHashMatched') result.errormsg = 'PreHashMatched'

      else if (resp.body?.code == 'QuotaExhausted.Drive') result.errormsg = '创建文件失败，网盘空间已满'
      else if (resp.body?.code == 'InvalidRapidProof') {

        let token = UserDAL.GetUserToken(user_id)
        if (token) await AliUser.ApiTokenRefreshAccount(token, true).catch(() => {})
        result.errormsg = resp.body.code
      } else result.errormsg = resp.body?.code || '创建失败，网络错误'

      return result
    }


    if (IsSuccess(resp.code)) {
      result.file_id = resp.body.file_id
      if (resp.body.exist) {
        if (IsBreakExist) {
          const issame = await AliUpload.UploadFileCheckHash(user_id, drive_id, result.file_id, hash)
          if (!issame) {
            await AliUpload.UploadFileDelete(user_id, drive_id, result.file_id).catch(() => {})
            return await AliUpload.UploadCreatFileWithFolders(user_id, drive_id, parentid, name, filesize, hash, proof_code, prehash, IsBreakExist)
          } else {
            result.israpid = true
          }
        } else {
          result.israpid = true
        }
      }
      result.isexist = resp.body.exist || false
      result.israpid = result.israpid || resp.body.rapid_upload || false
      result.upload_id = resp.body.upload_id || ''
      if (resp.body.part_info_list && resp.body.part_info_list.length > 0) {
        const part_info_list = resp.body.part_info_list
        for (let i = 0, maxi = part_info_list.length; i < maxi; i++) {
          const item = part_info_list[i]
          result.part_info_list.push({ upload_url: item.upload_url, part_number: item.part_number, part_size: partsize, isupload: false })
        }
      }
      return result
    } else {
      result.errormsg = '创建文件失败' + resp.code.toString()
      return result
    }
  }

  static async UploadFileCheckHash(user_id: string, drive_id: string, file_id: string, hash: string): Promise<boolean> {
    const url = 'v2/file/get'
    const postdata = { drive_id: drive_id, file_id: file_id }
    const resp = await AliHttp.Post(url, postdata, user_id, '')
    if (IsSuccess(resp.code) && resp.body.content_hash) {
      const content_hash = resp.body.content_hash.toUpperCase()
      hash = hash.toUpperCase()
      return hash === content_hash
    } else return false
  }

  static async UploadFileDelete(user_id: string, drive_id: string, file_id: string, permanently: boolean = false): Promise<boolean> {
    const url = 'v2/recyclebin/trash'
    const postdata = { drive_id: drive_id, file_id: file_id, permanently }
    const resp = await AliHttp.Post(url, postdata, user_id, '')
    if (IsSuccess(resp.code)) {
      return true
    } else return false
  }

  static async UploadFileComplete(user_id: string, drive_id: string, file_id: string, upload_id: string, filesize: number): Promise<boolean> {
    const url = 'v2/file/complete'
    const postdata = { drive_id: drive_id, upload_id: upload_id, file_id: file_id }
    let resp = await AliHttp.Post(url, postdata, user_id, '')
    if (resp.code == 400) {
      resp = await AliHttp.Post(url, postdata, user_id, '')
    }

    if (IsSuccess(resp.code)) {
      if (resp.body.size == filesize) return true
      else {

        await AliUpload.UploadFileDelete(user_id, drive_id, file_id, true).catch(() => {})
        DebugLog.mSaveLog('danger', '合并文件后发现大小不一致，删除已上传的文件，重新上传')
        return false
      }
    } else {
      DebugLog.mSaveLog('danger', '合并文件时出错' + resp.code + ' ' + JSON.stringify(resp.header || {}) + ' ' + JSON.stringify(resp.body || {}))
      return false
    }
  }

  static async UploadFilePartUrl(user_id: string, drive_id: string, file_id: string, upload_id: string, filesize: number, result: IUploadCreat) {
    const url = 'v2/file/get_upload_url'
    const postdata: {
      drive_id: string
      upload_id: string
      file_id: string
      part_info_list: { part_number: number; part_size: number }[]
    } = {
      drive_id: drive_id,
      upload_id: upload_id,
      file_id: file_id,
      part_info_list: []
    }
    let partindex = 0

    let partsize = 10485760
    while (filesize > partsize * 8000) partsize = partsize + 10485760

    while (partindex * partsize < filesize) {
      postdata.part_info_list.push({ part_number: partindex + 1, part_size: partsize })
      partindex++
    }
    postdata.part_info_list[partindex - 1].part_size = filesize - (partindex - 1) * partsize

    const resp = await AliHttp.Post(url, postdata, user_id, '')
    if (IsSuccess(resp.code)) {
      if (resp.body.part_info_list && resp.body.part_info_list.length > 0) {
        const part_info_list = resp.body.part_info_list
        if (result.part_info_list.length == 0) {

          for (let i = 0, maxi = part_info_list.length; i < maxi; i++) {
            const item = part_info_list[i]
            result.part_info_list.push({ upload_url: item.upload_url, part_number: item.part_number, part_size: partsize, isupload: false })
          }
        } else {

          for (let i = 0, maxi = part_info_list.length; i < maxi; i++) {
            const item = part_info_list[i]
            result.part_info_list[item.part_number - 1].upload_url = item.upload_url
          }
        }
      }
    }
  }

  static async UploadFileListUploadedParts(user_id: string, drive_id: string, file_id: string, upload_id: string, part_number_marker: number, result: IUploadCreat) {
    const url = 'v2/file/list_uploaded_parts'
    const postdata = { drive_id: drive_id, upload_id: upload_id, file_id: file_id, part_number_marker /*1开始*/ }
    const resp = await AliHttp.Post(url, postdata, user_id, '')

    if (IsSuccess(resp.code)) {
      if (resp.body.uploaded_parts && resp.body.uploaded_parts.length > 0) {
        const uploaded_parts = resp.body.uploaded_parts
        for (let i = 0, maxi = uploaded_parts.length; i < maxi; i++) {
          const item = uploaded_parts[i]
          const part_number = item.part_number
          result.part_info_list[part_number - 1].isupload = true
        }
      }
      if (resp.body.next_part_number_marker && parseInt(resp.body.next_part_number_marker) > 0) {
        const next = parseInt(resp.body.next_part_number_marker)
        await AliUpload.UploadFileListUploadedParts(user_id, drive_id, file_id, upload_id, next, result).catch(() => {})
      }
    }
  }

  /**
   * 获得文件上传证明的速度
   * @param UploadID
   */
  static GetFileUploadProofSpeed(UploadID: string) {
    return filelist.get(UploadID) || 0;
  }

  /**
   * 上传一个文件
   * @param user_id
   * @param uploadinfo
   * @param file
   */
  static async UploadOneFile(user_id: string, uploadinfo: IUploadCreat, file: IStateUploadFile): Promise<string> {
    if (uploadinfo.part_info_list.length > 1)
      return AliUpload.UploadOneFileBig(user_id, uploadinfo, file); //10MB 分片上传
    const upload_url = uploadinfo.part_info_list[0].upload_url;
    const filehandle = await fsPromises.open(file.Info.localFilePath, 'r').catch(() => {
      return undefined;
    });
    if (!filehandle) return '打开文件失败，请重试';
    filelist.set(file.UploadID, 0);
    let isok = '';
    for (let j = 0; j < 3; j++) {
      isok = await AliUpload.UploadOneFilePart(user_id, file.UploadID, filehandle, 0, file.Info.size, upload_url);
      if (isok == 'success') {
        break;
      }
    }
    await filehandle?.close();
    filelist.delete(file.UploadID);
    return AliUpload.UploadFileComplete(user_id, file.Info.drive_id, file.Upload.file_id, file.Upload.upload_id, file.Info.size)
      .then((issuccess) => {
        if (issuccess) return 'success';
        else return '合并文件时出错，请重试';
      })
      .catch(() => {
        return '合并文件时出错，请重试';
      });
  }

  /**
   * 上传一个大文件
   * @param user_id
   * @param uploadinfo
   * @param file
   */
  static async UploadOneFileBig(user_id: string, uploadinfo: IUploadCreat, file: IStateUploadFile): Promise<string> {
    filelist.set(file.UploadID, 0);
    const filehandle = await fsPromises.open(file.Info.localFilePath, 'r').catch(() => {
      return undefined;
    });
    if (!filehandle) return '打开文件失败，请重试';
    const filesize = file.Info.size;
    for (let i = 0; i < uploadinfo.part_info_list.length; i++) {
      let part = uploadinfo.part_info_list[i];
      const partstart = (part.part_number - 1) * 10485760;
      const partend = partstart + 10485760;
      const part_size = partend > filesize ? filesize - partstart : 10485760;

      if (part.isupload) {
        filelist.set(file.UploadID, partstart + part_size);
      } else {

        const url = part.upload_url;
        let expires = url.substr(url.indexOf('x-oss-expires=') + 'x-oss-expires='.length);
        expires = expires.substr(0, expires.indexOf('&'));
        const lasttime = parseInt(expires) - Date.now() / 1000;

        if (lasttime < 5 * 60) {
          await AliUpload.UploadFilePartUrl(user_id, file.Info.drive_id, file.Upload.file_id, file.Upload.upload_id, file.Info.size, uploadinfo);
          part = uploadinfo.part_info_list[i];
        }
        let isok = '';
        for (let j = 0; j < 3; j++) {
          isok = await AliUpload.UploadOneFilePart(user_id, file.UploadID, filehandle, partstart, part_size, part.upload_url);
          if (isok == 'success') {
            part.isupload = true;
            break;
          }
          if (file.Upload.DownState != '解析中' && file.Upload.DownState.indexOf('%') < 0) break;
        }
        if (file.Upload.DownState != '解析中' && file.Upload.DownState.indexOf('%') < 0) break;
        if (!part.isupload) {
          await filehandle?.close();
          filelist.delete(file.UploadID);
          return isok;
        }
      }
    }
    await filehandle?.close();
    filelist.delete(file.UploadID);
    if (file.Upload.DownState != '解析中' && file.Upload.DownState.indexOf('%') < 0) return '';

    for (let i = 0; i < uploadinfo.part_info_list.length; i++) {
      if (!uploadinfo.part_info_list[i].isupload) {
        return '有分片上传失败，请重试';
      }
    }
    return AliUpload.UploadFileComplete(user_id, file.Info.drive_id, file.Upload.file_id, file.Upload.upload_id, file.Info.size)
      .then((issuccess) => {
        if (issuccess) return 'success';
        else return '合并文件时出错，请重试';
      })
      .catch(() => {
        return '合并文件时出错，请重试';
      });
  }

  /**
   * 上传一个文件部分
   * @param user_id
   * @param UploadID
   * @param filehandle
   * @param partstart
   * @param partsize
   * @param upload_url
   */
  static UploadOneFilePart(user_id: string, UploadID: string, filehandle: FileHandle, partstart: number, partsize: number, upload_url: string) {
    const buff = Buffer.alloc(partsize);
    let token = UserDAL.GetUserToken(user_id)
    return filehandle
      .read(buff, 0, buff.length, partstart)
      .then((len: any) => {
        if (len && len.bytesRead == partsize) {
          return axios
            .put(upload_url, buff, {
              responseType: 'text',
              headers: {
                //timeout: 60000,
                'Content-Type': '',
                Authorization: token.token_type + ' ' + token.access_token,
              },
              onUploadProgress: function (progressEvent: ProgressEvent) {
                filelist.set(UploadID, partstart + progressEvent.loaded);
              },
            })
            .then(() => {
              return 'success';
            })
            .catch(function (error) {
              if (error.response?.status == 409 && error.response?.data && error.response?.data.indexOf('PartAlreadyExist') > 0) {
                return 'success';
              }
              return '网络错误 ' + error.toString() + '，请重试';
            });
        } else {
          return '读取文件数据失败，请重试';
        }
      })
      .catch(() => {
        return '读取文件数据失败，请重试';
      });
  }


}
