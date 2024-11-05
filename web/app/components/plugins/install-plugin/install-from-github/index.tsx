'use client'

import React, { useCallback, useState } from 'react'
import Modal from '@/app/components/base/modal'
import type { Item } from '@/app/components/base/select'
import type { InstallState } from '@/app/components/plugins/types'
import { useGitHubReleases } from '../hooks'
import { parseGitHubUrl } from '../utils'
import type { PluginDeclaration, UpdateFromGitHubPayload } from '../../types'
import { InstallStepFromGitHub } from '../../types'
import Toast from '@/app/components/base/toast'
import SetURL from './steps/setURL'
import SelectPackage from './steps/selectPackage'
import Installed from '../base/installed'
import Loaded from './steps/loaded'
import useGetIcon from '@/app/components/plugins/install-plugin/base/use-get-icon'
import { useTranslation } from 'react-i18next'
import { usePluginPageContext } from '../../plugin-page/context'

const i18nPrefix = 'plugin.installModal'

type InstallFromGitHubProps = {
  updatePayload?: UpdateFromGitHubPayload
  onClose: () => void
  onSuccess: () => void
}

const InstallFromGitHub: React.FC<InstallFromGitHubProps> = ({ updatePayload, onClose }) => {
  const { t } = useTranslation()
  const [state, setState] = useState<InstallState>({
    step: updatePayload ? InstallStepFromGitHub.selectPackage : InstallStepFromGitHub.setUrl,
    repoUrl: updatePayload?.originalPackageInfo.repo || '',
    selectedVersion: updatePayload?.originalPackageInfo.version || '',
    selectedPackage: updatePayload?.originalPackageInfo.package || '',
    releases: [],
  })
  const { getIconUrl } = useGetIcon()
  const [uniqueIdentifier, setUniqueIdentifier] = useState<string | null>(null)
  const [manifest, setManifest] = useState<PluginDeclaration | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const mutateInstalledPluginList = usePluginPageContext(v => v.mutateInstalledPluginList)

  const versions: Item[] = state.releases.map(release => ({
    value: release.tag_name,
    name: release.tag_name,
  }))

  const packages: Item[] = state.selectedVersion
    ? (state.releases
      .find(release => release.tag_name === state.selectedVersion)
      ?.assets
      .map(asset => ({
        value: asset.name,
        name: asset.name,
      })) || [])
    : []

  const { fetchReleases } = useGitHubReleases()

  const getTitle = useCallback(() => {
    if (state.step === InstallStepFromGitHub.installed)
      return t(`${i18nPrefix}.installedSuccessfully`)
    if (state.step === InstallStepFromGitHub.installFailed)
      return t(`${i18nPrefix}.installFailed`)

    return t(`${i18nPrefix}.installPlugin`)
  }, [state.step])

  const handleUrlSubmit = async () => {
    const { isValid, owner, repo } = parseGitHubUrl(state.repoUrl)
    if (!isValid || !owner || !repo) {
      Toast.notify({
        type: 'error',
        message: t('plugin.error.inValidGitHubUrl'),
      })
      return
    }
    await fetchReleases(owner, repo).then((fetchedReleases) => {
      setState(prevState => ({
        ...prevState,
        releases: fetchedReleases,
        step: InstallStepFromGitHub.selectPackage,
      }))
    })
  }

  const handleError = (e: any, isInstall: boolean) => {
    const message = e?.response?.message || t('plugin.installModal.installFailedDesc')
    setErrorMsg(message)
    setState(prevState => ({ ...prevState, step: isInstall ? InstallStepFromGitHub.installFailed : InstallStepFromGitHub.uploadFailed }))
  }

  const handleUploaded = async (GitHubPackage: any) => {
    try {
      const icon = await getIconUrl(GitHubPackage.manifest.icon)
      setManifest({
        ...GitHubPackage.manifest,
        icon,
      })
      setUniqueIdentifier(GitHubPackage.uniqueIdentifier)
      setState(prevState => ({ ...prevState, step: InstallStepFromGitHub.readyToInstall }))
    }
    catch (e) {
      handleError(e, false)
    }
  }

  const handleUploadFail = useCallback((errorMsg: string) => {
    setErrorMsg(errorMsg)
    setState(prevState => ({ ...prevState, step: InstallStepFromGitHub.uploadFailed }))
  }, [])

  const handleInstalled = useCallback(() => {
    mutateInstalledPluginList()
    setState(prevState => ({ ...prevState, step: InstallStepFromGitHub.installed }))
  }, [mutateInstalledPluginList])

  const handleFailed = useCallback((errorMsg?: string) => {
    setState(prevState => ({ ...prevState, step: InstallStepFromGitHub.installFailed }))
    if (errorMsg)
      setErrorMsg(errorMsg)
  }, [])

  const handleBack = () => {
    setState((prevState) => {
      switch (prevState.step) {
        case InstallStepFromGitHub.selectPackage:
          return { ...prevState, step: InstallStepFromGitHub.setUrl }
        case InstallStepFromGitHub.readyToInstall:
          return { ...prevState, step: InstallStepFromGitHub.selectPackage }
        default:
          return prevState
      }
    })
  }

  return (
    <Modal
      isShow={true}
      onClose={onClose}
      className='flex min-w-[560px] p-0 flex-col items-start rounded-2xl border-[0.5px]
        border-components-panel-border bg-components-panel-bg shadows-shadow-xl'
      closable
    >
      <div className='flex pt-6 pl-6 pb-3 pr-14 items-start gap-2 self-stretch'>
        <div className='flex flex-col items-start gap-1 flex-grow'>
          <div className='self-stretch text-text-primary title-2xl-semi-bold'>
            {getTitle()}
          </div>
          <div className='self-stretch text-text-tertiary system-xs-regular'>
            {!([InstallStepFromGitHub.uploadFailed, InstallStepFromGitHub.installed, InstallStepFromGitHub.installFailed].includes(state.step)) && t('plugin.installFromGitHub.installNote')}
          </div>
        </div>
      </div>
      {([InstallStepFromGitHub.uploadFailed, InstallStepFromGitHub.installed, InstallStepFromGitHub.installFailed].includes(state.step))
        ? <Installed
          payload={manifest}
          isFailed={[InstallStepFromGitHub.uploadFailed, InstallStepFromGitHub.installFailed].includes(state.step)}
          errMsg={errorMsg}
          onCancel={onClose}
        />
        : <div className={`flex px-6 py-3 flex-col justify-center items-start self-stretch ${state.step === InstallStepFromGitHub.installed ? 'gap-2' : 'gap-4'}`}>
          {state.step === InstallStepFromGitHub.setUrl && (
            <SetURL
              repoUrl={state.repoUrl}
              onChange={value => setState(prevState => ({ ...prevState, repoUrl: value }))}
              onNext={handleUrlSubmit}
              onCancel={onClose}
            />
          )}
          {state.step === InstallStepFromGitHub.selectPackage && (
            <SelectPackage
              updatePayload={updatePayload!}
              repoUrl={state.repoUrl}
              selectedVersion={state.selectedVersion}
              versions={versions}
              onSelectVersion={item => setState(prevState => ({ ...prevState, selectedVersion: item.value as string }))}
              selectedPackage={state.selectedPackage}
              packages={packages}
              onSelectPackage={item => setState(prevState => ({ ...prevState, selectedPackage: item.value as string }))}
              onUploaded={handleUploaded}
              onFailed={handleUploadFail}
              onBack={handleBack}
            />
          )}
          {state.step === InstallStepFromGitHub.readyToInstall && (
            <Loaded
              uniqueIdentifier={uniqueIdentifier!}
              payload={manifest as any}
              repoUrl={state.repoUrl}
              selectedVersion={state.selectedVersion}
              selectedPackage={state.selectedPackage}
              onBack={handleBack}
              onInstalled={handleInstalled}
              onFailed={handleFailed}
            />
          )}
        </div>}
    </Modal>
  )
}

export default InstallFromGitHub