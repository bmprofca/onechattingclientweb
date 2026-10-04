import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { Encrypt } from '../pages/encryption/payload-encryption';

// Send OTP
export const sendOtp = async ({ mobile, purpose }) => {
  const payload = { mobile, purpose };  // ← ADD purpose HERE!
  
  const { data, key } = Encrypt(payload);
  
  const data_pass = JSON.stringify({
    data,
    key
  });
  
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/account/send-otp`,  // ← Also check this URL!
    headers: {
      'Content-Type': 'application/json'
    },
    data: data_pass
  };
  
  const response = await axios.request(config);
  return response.data;
};

// Perform login and return the raw API response data
export const loginUser = async ({ mobile, otp, captcha_token }) => {
  const payload = { mobile, otp, ...(captcha_token && { captcha_token }) };

  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/account/login`,
    headers: {
      'Content-Type': 'application/json'
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// Logout User
export const logoutUser = async (token) => {
  if (!token) return { error: false };
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/account/logout`,
    headers: {
      'Content-Type': 'application/json',
      'token': token
    }
  };
  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    return { error: 'Failed to logout' };
  }
};

// Fetch user profile with projects
export const fetchUserProfile = async () => {
  // Get user data and project count
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/account/profile`,
    headers: {
      'token': token,
      'username': username,
      'Content-Type': 'application/json'
    }
  };

  const response = await axios.request(config);
  const apiData = response.data;

  // Transform API response to localStorage format and update localStorage
  if (!apiData.error) {
    const updatedUserData = {
      error: apiData.error,
      username: apiData.username,
      token: token, // Keep existing token
      profile: apiData.profile,
      balance: apiData.balance,
      project_count: apiData.projects?.project_count || 0,
      projects: apiData.projects?.list || [],
      pending_invitations: Array.isArray(apiData.pending_invitations) ? apiData.pending_invitations : [],
      selected_project_id: userData && Object.prototype.hasOwnProperty.call(userData, 'selected_project_id')
        ? (userData.selected_project_id || null)
        : (apiData.projects?.list?.[0]?.project_id || '')
    };

    // Update localStorage with transformed data
    localStorage.setItem('userData', JSON.stringify(updatedUserData));
    window.dispatchEvent(new Event('projects-updated'));
  }

  return apiData;
};

const readStoredAuth = () => {
  try {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    return null;
  }
};

const postEncrypted = async (path, payload) => {
  const userData = readStoredAuth();
  const { data, key } = Encrypt(payload || {});
  const response = await axios.post(
    `${API_BASE_URL}${path}`,
    JSON.stringify({ data, key }),
    {
      headers: {
        token: userData?.token,
        username: userData?.username,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
};

export const listAgentInvitations = () => postEncrypted('/agent/invitations', {});

export const respondAgentInvitation = ({ invitation_id, action }) =>
  postEncrypted('/agent/invitation/respond', { invitation_id, action });

// Update user profile
export const updateUserProfile = async ({ name, country_code, mobile, gender, firm_name, business_name, business_type }) => {
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    name,
    country_code,
    mobile,
    gender,
    firm_name,
    business_name,
    business_type,
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/account/edit-profile`,
    headers: {
      'token': token,
      'username': username,
      'Content-Type': 'application/json'
    },
    data: data_pass
  };

  const response = await axios.request(config);
  const apiData = response.data;

  if (!apiData.error && apiData.profile) {
    const updatedUserData = {
      ...userData,
      profile: apiData.profile,
    };
    localStorage.setItem('userData', JSON.stringify(updatedUserData));
  }

  return apiData;
};

// Create payment order (wallet topup – no project_id)
export const createPaymentOrder = async ({ amount, redirect_url, origin }) => {
  // Load auth tokens from localStorage to match existing API requirements
  const stored =
    typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
  const parsed = stored ? JSON.parse(stored) : null;
  const token = parsed?.token;
  const username = parsed?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    amount,
    redirect_url,
    ...(origin ? { origin } : {})
  };


  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/payment/wallet-topup`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// Verify payment
export const verifyPayment = async ({
  razorpay_payment_id,
  razorpay_order_id,
  razorpay_signature,
  amount,
  bonus,
  discount
}) => {
  const token = localStorage.getItem('token');

  const payload = {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    amount,
    bonus,
    discount
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/payment/verify`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// Validate promo code
export const validatePromoCode = async (code) => {
  const token = localStorage.getItem('token');

  const config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/payment/promo-code/validate?code=${code}`,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const response = await axios.request(config);
  return response.data;
};

// Get payment transactions
export const getPaymentTransactions = async () => {
  const token = localStorage.getItem('token');

  const config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/payment/transactions`,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const response = await axios.request(config);
  return response.data;
};

// Check payment status
export const checkPaymentStatus = async ({ project_id, order_id }) => {
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;
  console.log(token, username);


  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    project_id,
    order_id
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/payment/payment-status`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// Get project meta details
export const getProjectMetaDetails = async ({ project_id }) => {
  // Load auth tokens from localStorage to match existing API requirements
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;

  if (!token || !username) {
    throw new Error('Session expired 2');
  }

  const payload = {
    project_id
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/project/meta-details`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// Update WABA profile picture
export const updateWabaProfilePicture = async ({ project_id, profile_picture }) => {
  // Load auth tokens from localStorage to match existing API requirements
  const stored =
    typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
  const parsed = stored ? JSON.parse(stored) : null;
  const token = parsed?.token;
  const username = parsed?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    project_id,
    profile_picture
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/project/update-waba-profile-picture`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// Update WABA profile details (includes profile_picture URL)
export const updateWabaProfileDetails = async ({
  project_id,
  profile_picture,
  about,
  address,
  vertical,
  email,
  websites,
  description
}) => {
  // Load auth tokens from localStorage to match existing API requirements
  const stored =
    typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
  const parsed = stored ? JSON.parse(stored) : null;
  const token = parsed?.token;
  const username = parsed?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    project_id,
    ...(profile_picture != null && profile_picture !== '' ? { profile_picture } : {}),
    about,
    address,
    vertical,
    email,
    websites,
    description
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/project/update-waba-profile-details`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// Get embed signup link
export const getEmbedSignupLink = async ({ project_id }) => {
  // Load auth tokens from localStorage to match existing API requirements
  const stored =
    typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
  const parsed = stored ? JSON.parse(stored) : null;
  const token = parsed?.token;
  const username = parsed?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    project_id
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/project/embed-signup`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// -----------------------------------------------------------------------
// Get the active Meta Tech Provider config (own vs aisensy) for the
// embedded WhatsApp signup flow. GET request, no encrypted body needed.
//
// IMPORTANT: uses the exact same 'token' / 'username' header pattern as
// every other authenticated call in this file, because the backend's
// `auth` middleware only reads req.headers["token"] / req.headers["username"]
// (NOT an Authorization: Bearer header). Sending the wrong header shape
// here is what previously caused "Session expired" on this endpoint even
// with a valid, logged-in session.
// -----------------------------------------------------------------------
export const getEmbeddedSignupConfig = async () => {
  const stored =
    typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
  const parsed = stored ? JSON.parse(stored) : null;
  const token = parsed?.token;
  const username = parsed?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/project/embedded-signup-config`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    }
  };

  const response = await axios.request(config);
  return response.data; // { error: false, provider: 'own' | 'aisensy', meta_app_id, meta_config_id, meta_graph_version, solution_id }
};

// Submit WABA ID after Facebook signup
// NOTE: also forwards `code` and `phone_number_id`, required by the 'own'
// Meta Tech Provider flow on the backend (POST /project/submit-waba-id).
// Previously these were silently dropped here, so the 'own' provider flow
// always failed with "Authorization code missing" on the backend even
// though the frontend collected everything correctly.
export const submitWabaId = async ({ project_id, waba_id, code, phone_number_id }) => {
  // Load auth tokens from localStorage
  const stored =
    typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
  const parsed = stored ? JSON.parse(stored) : null;
  const token = parsed?.token;
  const username = parsed?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    project_id,
    ...(waba_id ? { waba_id } : {}),
    ...(code ? { code } : {}),
    ...(phone_number_id ? { phone_number_id } : {})
  };

  // Log payload before encryption for debugging
  console.log('[submitWabaId] Payload before encryption:', payload);

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  console.log('[submitWabaId] Encrypted data length:', data.length);
  console.log('[submitWabaId] Encryption key length:', key.length);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/project/submit-waba-id`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  console.log('[submitWabaId] Making API request to:', config.url);
  console.log('[submitWabaId] Request headers:', {
    'Content-Type': config.headers['Content-Type'],
    'token': token ? `${token.substring(0, 10)}...` : 'missing',
    'username': username || 'missing'
  });

  const response = await axios.request(config);

  console.log('[submitWabaId] API response status:', response.status);
  console.log('[submitWabaId] API response data:', response.data);

  return response.data;
};

// Create project
export const createProject = async ({
  company_name,
  project_name,
  package_id,
  pan,
  gst,
  firm_type,
  team_volume,
  client_volume,
  annual_revenue,
  industry,
  website,
  city,
}) => {
  // Load auth tokens from localStorage to match existing API requirements
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    company_name,
    project_name,
    pan,
    gst,
    firm_type,
    team_volume,
    client_volume,
    annual_revenue,
    industry,
    website,
    city,
    ...(package_id != null && package_id !== '' ? { package_id } : {})
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/project/create-project`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};


// Check user session
export const checkSession = async () => {
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;

  if (!token || !username) {
    // If no token locally, effectively logged out
    return { error: "session expired" };
  }

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/account/session-check`,
    headers: {
      'token': token,
      'username': username,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    // If API call fails (e.g. 401), consider session expired
    return { error: "session expired" };
  }
};


// Get subscription packs
export const getSubscriptionPacks = async () => {
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/plan`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    }
  };

  const response = await axios.request(config);
  return response.data;
};

// Purchase plan - subscribe selected projects to packages
export const purchasePlan = async ({ project }) => {
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }



  const payload = {
    projects: project
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/plan/purchase`,
    headers: {
      'Content-Type': 'application/json',
      token,
      username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};

// Get total unread message count
export const getTotalUnreadCount = async ({ project_id }) => {
  const getUserData = () => {
    try {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error parsing userData from localStorage:', error);
      return null;
    }
  };

  const userData = getUserData();
  const token = userData?.token;
  const username = userData?.username;

  if (!token || !username) {
    throw new Error('Session expired');
  }

  const payload = {
    project_id
  };

  // Encrypt the payload
  const { data, key } = Encrypt(payload);

  const data_pass = JSON.stringify({
    data,
    key
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${API_BASE_URL}/message/total-unread-count`,
    headers: {
      'Content-Type': 'application/json',
      'token': token,
      'username': username
    },
    data: data_pass
  };

  const response = await axios.request(config);
  return response.data;
};