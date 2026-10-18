import { useEffect, useRef, useState } from 'react'
import { t, tn } from '../i18n'
import { parseBackup } from '../lib/backup'
import { downloadJson } from '../lib/export'
import { getStorageStatus, type StorageStatus } from '../lib/storage'
import { useApp } from '../state/AppState'
import { Dialog, Icon } from './ui'

/** Where your data lives, backup/restore between browsers or devices, and reset. */
export function DataSection() {
  const { history, exportBackup, importBackup, resetAll, dataMessage: message, setDataMessage: setMessage } = useApp()
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getStorageStatus().then(setStatus)
  }, [])

  const onExport = () => {
    downloadJson(`pl300-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup())
    setMessage({ ok: true, text: t('data.export.done') })
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    const backup = parseBackup(await file.text())
    if (!backup) {
      setMessage({ ok: false, text: t('data.import.error') })
    } else {
      const added = importBackup(backup)
      setMessage({ ok: true, text: tn('data.import.ok', added) })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="data-title">
      <div>
        <h2 id="data-title" className="text-lg font-bold">
          {t('data.title')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('data.subtitle')}</p>
      </div>

      {status && (
        <ul className="space-y-1.5 text-sm">
          {status.available ? (
            <li className="flex items-center gap-2 font-semibold text-ok">
              <Icon name="check" className="size-4" />
              {t('data.status.ok')}
            </li>
          ) : (
            <li className="flex items-center gap-2 font-semibold text-bad">
              <Icon name="alert" className="size-4" />
              {t('data.status.unavailable')}
            </li>
          )}
          {status.available && status.persisted === true && (
            <li className="flex items-center gap-2 text-muted">
              <Icon name="check" className="size-4" />
              {t('data.persist.yes')}
            </li>
          )}
          {status.available && status.persisted !== true && (
            <li className="flex items-center gap-2 text-muted">
              <Icon name="info" className="size-4" />
              {t('data.persist.no')}
            </li>
          )}
          {status.available && status.mirror && (
            <li className="flex items-center gap-2 text-muted">
              <Icon name="check" className="size-4" />
              {t('data.mirror')}
            </li>
          )}
        </ul>
      )}

      <div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={onExport}>
            <Icon name="download" className="size-4" />
            {t('data.export')}
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="refresh" className="size-4" />
            {t('data.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('data.import')}
            onChange={(e) => void onImport(e.target.files?.[0])}
          />
        </div>
        <p className="mt-2 text-xs text-muted">{t('data.backup.hint')}</p>
        {message && (
          <p role="status" className={`mt-3 text-sm font-semibold ${message.ok ? 'text-ok' : 'text-bad'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <div>
          <h3 className="font-bold">{t('reset.title')}</h3>
          <p className="text-sm text-muted">{tn('reset.body', history.length)}</p>
        </div>
        <button type="button" className="btn-danger" onClick={() => setConfirmReset(true)}>
          <Icon name="trash" className="size-4" />
          {t('reset.button')}
        </button>
      </div>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('reset.confirm.title')}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmReset(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setConfirmReset(false)
                resetAll()
              }}
            >
              {t('reset.confirm.yes')}
            </button>
          </>
        }
      >
        {t('reset.confirm.body')}
      </Dialog>
    </section>
  )
}
