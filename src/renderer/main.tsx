/**
 * @license
 * Copyright 2025 CodeConductor (CodeConductor.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Layout from './layout';
import Router from './router';
import Sider from './sider';
import { useAuth } from './context/AuthContext';
import UpdateNotification from './components/UpdateNotification';

const Main = () => {
  const { ready } = useAuth();

  if (!ready) {
    return null;
  }

  return (
    <>
      <Router layout={<Layout sider={<Sider />} />} />
      <UpdateNotification />
    </>
  );
};

export default Main;
