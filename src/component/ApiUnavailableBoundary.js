import React, { useEffect, useState } from 'react';
import { API_UNAVAILABLE_EVENT, isApiUnavailable } from '../api/http/availability';
import ServerUnavailable from '../pages/error/ServerUnavailable';

const ApiUnavailableBoundary = ({ children }) => {
  const [unavailable, setUnavailable] = useState(isApiUnavailable);

  useEffect(() => {
    const showUnavailablePage = () => setUnavailable(true);
    window.addEventListener(API_UNAVAILABLE_EVENT, showUnavailablePage);
    if (isApiUnavailable()) showUnavailablePage();
    return () => window.removeEventListener(API_UNAVAILABLE_EVENT, showUnavailablePage);
  }, []);

  return unavailable ? <ServerUnavailable /> : children;
};

export default ApiUnavailableBoundary;
