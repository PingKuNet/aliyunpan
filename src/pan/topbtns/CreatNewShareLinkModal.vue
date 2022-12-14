<script lang="ts">
import { IAliGetFileModel } from '../../aliapi/alimodels'
import { modalCloseAll } from '../../utils/modal'
import { defineComponent, PropType, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { usePanTreeStore, useSettingStore } from '../../store'
import { humanDateTime, randomSharePassword } from '../../utils/format'
import message from '../../utils/message'
import AliShare from '../../aliapi/share'
import ShareDAL from '../../share/share/ShareDAL'
import { ArrayKeyList } from '../../utils/utils'
import { copyToClipboard } from '../../utils/electronhelper'
import { GetShareUrlFormate } from '../../utils/shareurl'

export default defineComponent({
  props: {
    visible: {
      type: Boolean,
      required: true
    },
    sharetype: {
      type: String,
      required: true
    },
    filelist: {
      type: Array as PropType<IAliGetFileModel[]>,
      required: true
    }
  },
  setup(props) {
    const okLoading = ref(false)
    const formRef = ref()
    const settingStore = useSettingStore()
    const form = reactive({
      expiration: '',
      share_pwd: '',
      share_name: '',
      mutil: false
    })
    const handleOpen = () => {
      
      form.share_name = props.filelist[0].name

      let share_pwd = ''
      if (settingStore.uiSharePassword == 'random') share_pwd = randomSharePassword()
      else if (settingStore.uiSharePassword == 'last') share_pwd = localStorage.getItem('share_pwd') || ''
      form.share_pwd = share_pwd

      let expiration = Date.now()
      if (settingStore.uiShareDays == 'always') expiration = 0
      else if (settingStore.uiShareDays == 'week') expiration += 7 * 24 * 60 * 60 * 1000
      else expiration += 30 * 24 * 60 * 60 * 1000

      form.expiration = expiration > 0 ? humanDateTime(expiration) : ''
    }

    const handleClose = () => {
      
      if (okLoading.value) okLoading.value = false
    }
    return { okLoading, handleOpen, handleClose, formRef, form, dayjs }
  },
  methods: {
    handleHide() {
      modalCloseAll()
    },
    async handleOK(multi: boolean) {
      const pantreeStore = usePanTreeStore()
      if (!pantreeStore.user_id || !pantreeStore.drive_id || !pantreeStore.selectDir.file_id) {
        message.error('?????????????????? ??????????????????')
        return
      }

      const mindate = new Date()
      mindate.setMinutes(mindate.getMinutes() + 2)
      let expiration = this.form.expiration
      if (expiration) expiration = new Date(expiration) < mindate ? mindate.toISOString() : new Date(expiration).toISOString()
      else expiration = ''

      let share_name = this.form.share_name.trim().replaceAll('"', '')
      share_name = share_name.replace(/[<>:"\\|?*]+/g, '')
      share_name = share_name.replace(/[\f\n\r\t\v]/g, '')
      while (share_name.endsWith(' ') || share_name.endsWith('.')) share_name = share_name.substring(0, share_name.length - 1)
      if (share_name.length < 1) {
        message.error('??????????????????????????????')
        return
      }
      const share_pwd = this.form.share_pwd

      const user_id = pantreeStore.user_id
      const drive_id = pantreeStore.drive_id
      const file_id_list = ArrayKeyList<string>('file_id', this.filelist)
      this.okLoading = true
      
      localStorage.setItem('share_pwd', share_pwd)
      if (multi == false) {
        const result = await AliShare.ApiCreatShare(user_id, drive_id, expiration, share_pwd, share_name, file_id_list)

        if (typeof result == 'string') {
          this.okLoading = false
          message.error(result)
          return
        }

        if (result.share_name != share_name) {
          await AliShare.ApiUpdateShareBatch(user_id, [result.share_id], [result.expiration], [result.share_pwd], [share_name])
        }
        const url = GetShareUrlFormate(result.share_name, result.share_url, result.share_pwd)
        copyToClipboard(url)
        await ShareDAL.aReloadMyShareUntilShareID(user_id, result.share_id)
        message.success('????????????????????????????????????????????????????????????')
        this.okLoading = false
        modalCloseAll()
      } else {
        const result = await AliShare.ApiCreatShareBatch(user_id, drive_id, expiration, share_pwd, file_id_list)

        if (result.reslut.length > 0) {
          let url = ''
          for (let i = 0, maxi = result.reslut.length; i < maxi; i++) {
            const share = result.reslut[i]
            url += GetShareUrlFormate(share.share_name!, share.share_url!, share.share_pwd!) + '\n'
          }
          copyToClipboard(url)
          await ShareDAL.aReloadMyShareUntilShareID(user_id, result.reslut[0].share_id!)
          message.success('?????? ' + result.count.toString() + '??? ??????????????????????????????????????????????????????')
        } else {
          message.success('??????????????????????????????')
        }
        this.okLoading = false
        modalCloseAll()
      }
    }
  }
})
</script>

<template>
  <a-modal :visible="visible" modal-class="modalclass" :footer="false" :unmount-on-close="true" :mask-closable="false" @cancel="handleHide" @before-open="handleOpen" @close="handleClose">
    <template #title>
      <span class="modaltitle"
        >??????????????????<span class="titletips"> (?????????{{ filelist.length }}?????????) </span></span
      >
    </template>
    <div class="modalbody" style="width: 440px">
      <a-form ref="formRef" :model="form" layout="vertical">
        <a-form-item field="share_name">
          <template #label>?????????????????????<span class="opblue" style="margin-left: 16px; font-size: 12px"> ???????????????????????????????????? </span> </template>
          <a-input v-model.trim="form.share_name" :placeholder="form.share_name" />
        </a-form-item>

        <a-row>
          <a-col flex="200px"> ????????????</a-col>
          <a-col flex="12px"></a-col>
          <a-col flex="100px"> ????????????</a-col>
          <a-col flex="auto"></a-col>
        </a-row>
        <a-row>
          <a-col flex="200px">
            <a-form-item field="expiration">
              <a-date-picker
                v-model="form.expiration"
                style="width: 200px; margin: 0"
                show-time
                placeholder="????????????"
                value-format="YYYY-MM-DD HH:mm:ss"
                :shortcuts="[
                  {
                    label: '??????',
                    value: () => ''
                  },
                  {
                    label: '3??????',
                    value: () => dayjs().add(3, 'hour')
                  },
                  {
                    label: '1???',
                    value: () => dayjs().add(1, 'day')
                  },
                  {
                    label: '3???',
                    value: () => dayjs().add(3, 'day')
                  },
                  {
                    label: '7???',
                    value: () => dayjs().add(7, 'day')
                  },
                  {
                    label: '30???',
                    value: () => dayjs().add(30, 'day')
                  }
                ]" />
            </a-form-item>
          </a-col>
          <a-col flex="12px"></a-col>
          <a-col flex="120px">
            <a-form-item field="share_pwd" :rules="[{ length: 4, message: '??????????????????4?????????' }]">
              <a-input v-model="form.share_pwd" tabindex="-1" placeholder="????????????" />
            </a-form-item>
          </a-col>
          <a-col flex="auto"></a-col>
        </a-row>
      </a-form>
    </div>
    <div class="modalfoot">
      <a-button type="outline" size="small" :loading="okLoading" @click="() => handleOK(true)">???????????????????????????</a-button>
      <div style="flex-grow: 1"></div>
      <a-button v-if="!okLoading" type="outline" size="small" @click="handleHide">??????</a-button>
      <a-button type="primary" size="small" :loading="okLoading" @click="() => handleOK(false)">??????????????????</a-button>
    </div>
  </a-modal>
</template>

<style></style>
