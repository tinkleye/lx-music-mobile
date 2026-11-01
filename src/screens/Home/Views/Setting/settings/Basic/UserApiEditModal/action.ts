import { importUserApi } from '@/core/userApi'
import { readFile } from '@/utils/fs'
import { log } from '@/utils/log'
import { toast } from '@/utils/tools'


export const handleImportScript = async(script: string, sourceUrl?: string) => {
  await importUserApi(script, sourceUrl).then(({ updated, info }) => {
    // 【改造】同一来源地址再次导入时是「原地更新」，不会再新增一条
    toast(updated
      ? global.i18n.t('user_api_update_success_tip', {
        name: info.name,
        version: info.version ? `v${info.version}` : '',
      })
      : global.i18n.t('user_api_import_success_tip'))
  }).catch((error: any) => {
    log.error(error.stack)
    toast(global.i18n.t('user_api_import_failed_tip', { message: error.message }), 'long')
  })
}

export const handleImportLocalFile = (path: string) => {
  // toast(global.i18n.t('setting_backup_part_import_list_tip_unzip'))
  void readFile(path).then(async script => {
    if (script == null) throw new Error('Read file failed')
    void handleImportScript(script)
  }).catch((error: any) => {
    toast(global.i18n.t('user_api_import_failed_tip', { message: error.message }), 'long')
  })
}

