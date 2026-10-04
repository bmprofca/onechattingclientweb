import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiCheck, FiCreditCard, FiDollarSign, FiX } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { createProject, fetchUserProfile, getSubscriptionPacks } from '../../api/auth';
import SearchableSelect from '../SearchableSelect';

const FIRM_TYPES = ['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'Other'];
const TEAM_VOLUMES = ['1-5', '6-20', '21-50', '51-200', '200+'];
const CLIENT_VOLUMES = ['1-50', '51-200', '201-1000', '1000+'];
const REVENUE_RANGES = ['Under ₹10L', '₹10L-₹50L', '₹50L-₹1Cr', '₹1Cr-₹5Cr', '₹5Cr+'];

const emptyProjectForm = {
  company_name: '',
  name: '',
  pan: '',
  gst: '',
  firm_type: '',
  team_volume: '',
  client_volume: '',
  annual_revenue: '',
  industry: '',
  website: '',
  city: '',
};

const PROJECT_FIELD_ORDER = [
  'company_name',
  'name',
  'pan',
  'gst',
  'firm_type',
  'industry',
  'team_volume',
  'client_volume',
  'annual_revenue',
  'city',
  'website',
];

const validateProjectForm = (form) => {
  const errors = {};
  if (!form.company_name.trim()) errors.company_name = 'Enter the company name';
  if (!form.name.trim()) errors.name = 'Enter the project name';

  const pan = form.pan.trim().toUpperCase();
  const gst = form.gst.trim().toUpperCase();
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errors.pan = 'Enter a valid PAN (for example ABCDE1234F)';
  if (gst && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) errors.gst = 'Enter a valid 15-character GSTIN';
  if (form.firm_type && !FIRM_TYPES.includes(form.firm_type)) errors.firm_type = 'Select a valid firm type';
  if (form.team_volume && !TEAM_VOLUMES.includes(form.team_volume)) errors.team_volume = 'Select a valid team volume';
  if (form.client_volume && !CLIENT_VOLUMES.includes(form.client_volume)) errors.client_volume = 'Select a valid client volume';
  if (form.annual_revenue && !REVENUE_RANGES.includes(form.annual_revenue)) errors.annual_revenue = 'Select a valid annual revenue';
  if (form.website.trim() && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(form.website.trim())) {
    errors.website = 'Enter a valid website';
  }
  return errors;
};

const fieldClass = (hasError) =>
  `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
    hasError ? 'border-red-400' : 'border-gray-300'
  }`;

const CreateProjectModal = ({ isOpen, onClose, onCreated }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(emptyProjectForm);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [subscriptionPackage, setSubscriptionPackage] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [packageLoading, setPackageLoading] = useState(false);
  const [showWalletRechargeModal, setShowWalletRechargeModal] = useState(false);
  const [walletRechargeAmount, setWalletRechargeAmount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(emptyProjectForm);
    setFormErrors({});
    setBillingCycle('monthly');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    const fetchPackage = async () => {
      setPackageLoading(true);
      try {
        const response = await getSubscriptionPacks();
        if (!cancelled && !response.error && response.data?.package) {
          setSubscriptionPackage(response.data.package);
        }
      } catch (err) {
        console.error('Failed to fetch package pricing:', err);
      } finally {
        if (!cancelled) setPackageLoading(false);
      }
    };
    fetchPackage();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && !showWalletRechargeModal) return undefined;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, showWalletRechargeModal]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateProjectForm(formData);
    setFormErrors(errors);
    const firstInvalid = PROJECT_FIELD_ORDER.find((key) => errors[key]);
    if (firstInvalid) {
      const field = e.currentTarget.elements.namedItem(firstInvalid);
      if (field && typeof field.focus === 'function') {
        field.focus();
        field.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      return;
    }

    try {
      setSubmitting(true);
      const packageId = subscriptionPackage?.[billingCycle]?.package_id ||
        (billingCycle === 'yearly' ? 'PROJECT_1Y' : 'PROJECT_1M');
      const response = await createProject({
        company_name: formData.company_name.trim(),
        project_name: formData.name.trim(),
        package_id: packageId,
        pan: formData.pan.trim().toUpperCase(),
        gst: formData.gst.trim().toUpperCase(),
        firm_type: formData.firm_type,
        team_volume: formData.team_volume,
        client_volume: formData.client_volume,
        annual_revenue: formData.annual_revenue,
        industry: formData.industry.trim(),
        website: formData.website.trim(),
        city: formData.city.trim(),
      });

      const responseError = response?.error;
      const hasError =
        !response ||
        responseError === true ||
        responseError === 1 ||
        responseError === 'true' ||
        (typeof responseError === 'string' && responseError.trim() !== '');

      if (hasError) {
        const errorMessage =
          (typeof responseError === 'string' && responseError.trim()) ||
          response?.message ||
          response?.msg ||
          'Failed to create project';
        toast.error(errorMessage);
        return;
      }

      toast.success('Project created successfully');
      const profileResponse = await fetchUserProfile();
      onClose();
      if (onCreated) onCreated(profileResponse);
    } catch (error) {
      console.error('Error creating project:', error);
      if (error.response?.status === 402) {
        const amount = subscriptionPackage?.[billingCycle]?.amount != null
          ? Number(subscriptionPackage[billingCycle].amount)
          : 0;
        setWalletRechargeAmount(amount);
        setShowWalletRechargeModal(true);
      } else {
        toast.error(error?.message || error.response?.data?.error || 'Failed to create project');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[92vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0">
                <div className="flex items-center space-x-3">
                  <FiBriefcase className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Create New Project</h3>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden" noValidate>
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                      <input
                        type="text"
                        name="company_name"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className={fieldClass(formErrors.company_name)}
                        placeholder="Enter company name"
                      />
                      {formErrors.company_name && <p className="mt-1 text-xs text-red-600">{formErrors.company_name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={fieldClass(formErrors.name)}
                        placeholder="Enter project name"
                      />
                      {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">PAN <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        name="pan"
                        value={formData.pan}
                        maxLength={10}
                        onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                        className={fieldClass(formErrors.pan)}
                        placeholder="ABCDE1234F"
                      />
                      {formErrors.pan && <p className="mt-1 text-xs text-red-600">{formErrors.pan}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">GST <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        name="gst"
                        value={formData.gst}
                        maxLength={15}
                        onChange={(e) => setFormData({ ...formData, gst: e.target.value.toUpperCase() })}
                        className={fieldClass(formErrors.gst)}
                        placeholder="22AAAAA0000A1Z5"
                      />
                      {formErrors.gst && <p className="mt-1 text-xs text-red-600">{formErrors.gst}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Firm type <span className="text-gray-400 font-normal">(optional)</span></label>
                      <SearchableSelect
                        name="firm_type"
                        value={formData.firm_type}
                        onChange={(e) => setFormData({ ...formData, firm_type: e.target.value })}
                        options={[{ value: '', label: 'Select firm type' }, ...FIRM_TYPES.map((option) => ({ value: option, label: option }))]}
                        placeholder="Select firm type"
                        className={fieldClass(formErrors.firm_type)}
                      />
                      {formErrors.firm_type && <p className="mt-1 text-xs text-red-600">{formErrors.firm_type}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Industry <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        name="industry"
                        value={formData.industry}
                        maxLength={120}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className={fieldClass(formErrors.industry)}
                        placeholder="Retail, education, healthcare..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Team volume <span className="text-gray-400 font-normal">(optional)</span></label>
                      <SearchableSelect
                        name="team_volume"
                        value={formData.team_volume}
                        onChange={(e) => setFormData({ ...formData, team_volume: e.target.value })}
                        options={[{ value: '', label: 'Select team size' }, ...TEAM_VOLUMES.map((option) => ({ value: option, label: option }))]}
                        placeholder="Select team size"
                        className={fieldClass(formErrors.team_volume)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Client volume <span className="text-gray-400 font-normal">(optional)</span></label>
                      <SearchableSelect
                        name="client_volume"
                        value={formData.client_volume}
                        onChange={(e) => setFormData({ ...formData, client_volume: e.target.value })}
                        options={[{ value: '', label: 'Select client volume' }, ...CLIENT_VOLUMES.map((option) => ({ value: option, label: option }))]}
                        placeholder="Select client volume"
                        className={fieldClass(formErrors.client_volume)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Annual revenue <span className="text-gray-400 font-normal">(optional)</span></label>
                      <SearchableSelect
                        name="annual_revenue"
                        value={formData.annual_revenue}
                        onChange={(e) => setFormData({ ...formData, annual_revenue: e.target.value })}
                        options={[{ value: '', label: 'Select annual revenue' }, ...REVENUE_RANGES.map((option) => ({ value: option, label: option }))]}
                        placeholder="Select annual revenue"
                        className={fieldClass(formErrors.annual_revenue)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        maxLength={100}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className={fieldClass(false)}
                        placeholder="City"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Website <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        name="website"
                        value={formData.website}
                        maxLength={255}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className={fieldClass(formErrors.website)}
                        placeholder="https://example.com"
                      />
                      {formErrors.website && <p className="mt-1 text-xs text-red-600">{formErrors.website}</p>}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Package</label>
                      {packageLoading ? (
                        <div className="text-sm text-gray-500 py-2">Loading pricing...</div>
                      ) : subscriptionPackage ? (
                        <div className="space-y-3">
                          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-100">
                            <button
                              type="button"
                              onClick={() => setBillingCycle('monthly')}
                              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${billingCycle === 'monthly'
                                ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
                                : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              Monthly — ₹{subscriptionPackage.monthly?.amount != null ? Number(subscriptionPackage.monthly.amount).toLocaleString() : '0'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setBillingCycle('yearly')}
                              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${billingCycle === 'yearly'
                                ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
                                : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              Yearly — ₹{subscriptionPackage.yearly?.amount != null ? Number(subscriptionPackage.yearly.amount).toLocaleString() : '0'}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">
                            {billingCycle === 'monthly' ? 'Billed per month per project.' : 'Billed per year per project.'}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Pricing not available.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitting}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiCheck size={18} />
                    <span>{submitting ? 'Creating...' : 'Create Project'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWalletRechargeModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="p-6 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                  <FiDollarSign className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Insufficient wallet balance</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your wallet balance is not enough to complete this action. Please recharge your wallet to continue.
                </p>
                <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-6">
                  Amount due: ₹{Number(walletRechargeAmount).toLocaleString()}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setShowWalletRechargeModal(false)}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/wallet-recharge/${walletRechargeAmount}`)}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <FiCreditCard className="mr-2 w-4 h-4" />
                    Recharge wallet
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CreateProjectModal;
