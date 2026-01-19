/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Modal, Progress, Button, Space, Typography, Divider } from '@arco-design/web-react';
import { IconDownload, IconRefresh, IconClose } from '@arco-design/web-react/icon';
import React, { useEffect, useState } from 'react';
import { ipcBridge } from '@/common';

const { Text, Paragraph } = Typography;

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

/**
 * Auto-updater notification component
 * Display update notifications and download progress
 */
export const UpdateNotification: React.FC = () => {
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    // Listen for update available
    const unsubscribeAvailable = ipcBridge.updater.onUpdateAvailable.on((info) => {
      console.log('[UpdateNotification] Update available:', info);
      setUpdateInfo(info);
      setUpdateState('available');
      setModalVisible(true);
    });

    // Listen for update not available
    const unsubscribeNotAvailable = ipcBridge.updater.onUpdateNotAvailable.on(() => {
      console.log('[UpdateNotification] No update available');
      setUpdateState('idle');
    });

    // Listen for download progress
    const unsubscribeProgress = ipcBridge.updater.onDownloadProgress.on((progress) => {
      console.log('[UpdateNotification] Download progress:', progress.percent.toFixed(2) + '%');
      setDownloadProgress(progress);
      setUpdateState('downloading');
    });

    // Listen for update downloaded
    const unsubscribeDownloaded = ipcBridge.updater.onUpdateDownloaded.on((info) => {
      console.log('[UpdateNotification] Update downloaded:', info.version);
      setUpdateState('downloaded');
      setDownloadProgress(null);
    });

    // Listen for errors
    const unsubscribeError = ipcBridge.updater.onError.on((error) => {
      console.error('[UpdateNotification] Update error:', error.message);
      setErrorMessage(error.message);
      setUpdateState('error');
      setModalVisible(true);
    });

    return () => {
      unsubscribeAvailable();
      unsubscribeNotAvailable();
      unsubscribeProgress();
      unsubscribeDownloaded();
      unsubscribeError();
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateState('checking');
    setErrorMessage('');
    try {
      await ipcBridge.updater.checkForUpdates.invoke();
    } catch (error) {
      console.error('[UpdateNotification] Failed to check for updates:', error);
      setUpdateState('error');
      setErrorMessage('Failed to check for updates');
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      await ipcBridge.updater.downloadUpdate.invoke();
    } catch (error) {
      console.error('[UpdateNotification] Failed to download update:', error);
      setErrorMessage('Failed to download update');
      setUpdateState('error');
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await ipcBridge.updater.quitAndInstall.invoke();
    } catch (error) {
      console.error('[UpdateNotification] Failed to install update:', error);
    }
  };

  const handleClose = () => {
    setModalVisible(false);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  // Render modal content based on update state
  const renderModalContent = () => {
    if (updateState === 'error') {
      return (
        <div>
          <Paragraph style={{ color: '#f53f3f' }}>Update error: {errorMessage}</Paragraph>
          <Paragraph>Please try again later or check your network connection.</Paragraph>
        </div>
      );
    }

    if (updateState === 'available' && updateInfo) {
      return (
        <div>
          <Paragraph>
            <Text bold>New version available: {updateInfo.version}</Text>
          </Paragraph>
          {updateInfo.releaseNotes && (
            <>
              <Divider />
              <Paragraph>
                <Text bold>Release Notes:</Text>
              </Paragraph>
              <Paragraph style={{ maxHeight: '200px', overflow: 'auto' }}>{updateInfo.releaseNotes}</Paragraph>
            </>
          )}
        </div>
      );
    }

    if (updateState === 'downloading' && downloadProgress) {
      return (
        <div>
          <Paragraph>
            <Text bold>Downloading update...</Text>
          </Paragraph>
          <Progress percent={downloadProgress.percent} showText={true} />
          <Paragraph style={{ marginTop: 8, fontSize: 12, color: '#86909c' }}>
            {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
            {' • '}
            {formatSpeed(downloadProgress.bytesPerSecond)}
          </Paragraph>
        </div>
      );
    }

    if (updateState === 'downloaded') {
      return (
        <div>
          <Paragraph>
            <Text bold style={{ color: '#00b42a' }}>
              Update downloaded successfully!
            </Text>
          </Paragraph>
          <Paragraph>The update will be installed when you restart the application. Click "Restart Now" to install the update immediately.</Paragraph>
        </div>
      );
    }

    return null;
  };

  // Render modal footer based on update state
  const renderModalFooter = () => {
    if (updateState === 'error') {
      return (
        <Space>
          <Button onClick={handleClose}>Close</Button>
          <Button type='primary' onClick={handleCheckForUpdates}>
            Retry
          </Button>
        </Space>
      );
    }

    if (updateState === 'available') {
      return (
        <Space>
          <Button onClick={handleClose}>Later</Button>
          <Button type='primary' icon={<IconDownload />} onClick={handleDownloadUpdate}>
            Download Now
          </Button>
        </Space>
      );
    }

    if (updateState === 'downloading') {
      return <Button disabled>Downloading...</Button>;
    }

    if (updateState === 'downloaded') {
      return (
        <Space>
          <Button onClick={handleClose}>Later</Button>
          <Button type='primary' icon={<IconRefresh />} onClick={handleInstallUpdate}>
            Restart Now
          </Button>
        </Space>
      );
    }

    return null;
  };

  const getModalTitle = () => {
    switch (updateState) {
      case 'error':
        return 'Update Error';
      case 'available':
        return 'Update Available';
      case 'downloading':
        return 'Downloading Update';
      case 'downloaded':
        return 'Update Ready';
      default:
        return 'Software Update';
    }
  };

  return (
    <Modal title={getModalTitle()} visible={modalVisible} onCancel={handleClose} footer={renderModalFooter()} closable={updateState !== 'downloading'} maskClosable={false} style={{ width: 480 }}>
      {renderModalContent()}
    </Modal>
  );
};

export default UpdateNotification;
