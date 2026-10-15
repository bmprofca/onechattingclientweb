import { installDefaultTransport } from './api/http/transport';
import ReactDOM from 'react-dom/client';
import './index.css';
import Error_404 from './pages/error/Error_404';
import Dashboard from './pages/Dashboard';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from './pages/Login';
import Register from './pages/Register';
import QRLanding from './pages/QRLanding';
import LiveChat from './pages/LiveChat';
import Template from './pages/Template';
import TemplateAdd from './pages/TemplateAdd';
import TemplateEdit from './pages/TemplateEdit';
import TemplateView from './pages/TemplateView';
import Contact from './pages/Contact';
import ContactGroup from './pages/ContactGroup';
import ContactGroupList from './pages/ContactGroupList';
import AgentManagement from './pages/AgentManagement';
import MySubscription from './pages/MySubscription';
import Blank from './pages/Blank';
import PermissionsList from './pages/PermissionsList';
import { Provider } from 'react-redux';
import store from './store';
import { Toaster } from 'react-hot-toast';
import CreateCampaign from './pages/Campaign/CreateCampaign';
import Transactions from './pages/Transactions';
import AiBills from './pages/AiBills';
import Projects from './pages/Projects';
import CampaignList from './pages/Campaign/CampaignList';
import CampaignDetails from './pages/Campaign/CampaignDetails.js';
import AutoReply from './pages/Automation/AutoReply';
import Flow from './pages/Automation/Flow';
import FlowList from './pages/Automation/FlowList';
import OpenCaseList from './pages/OpenCaseList';
import ScannedUsers from './pages/ScannedUsers';
import MyProfile from './pages/MyProfile.js';
import WalletRecharge from './pages/WalletRecharge.js';
import PaymentStatus from './pages/PaymentStatus.js';
import ProjectDetails from './pages/ProjectDetails';
import ProjectConfig from './pages/ProjectConfig';
import AgentConfig from './pages/AgentConfig';
import ContextConfig from './pages/ContextConfig';
import DeveloperAccess from './pages/DeveloperAccess';
import Support from './pages/Support';
import ProtectedRoute from './component/ProtectedRoute';
import { ShellProvider } from './component/Menu';
import { ThemeProvider } from './theme/ThemeContext';


// API transport for every axios request to the OneChatting API (must run before any request)
installDefaultTransport();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <ThemeProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 4000,
              theme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              theme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <ShellProvider>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/dasboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path='scanned-users' element={
            <ProtectedRoute requiresProject={true}>
              <ScannedUsers />
            </ProtectedRoute>
          } />
          {/* Protected routes that require project */}
          <Route path="/live-chat" element={
            <ProtectedRoute requiresProject={true}>
              <LiveChat />
            </ProtectedRoute>
          } />
          <Route path="/open-cases" element={
            <ProtectedRoute requiresProject={true}>
              <OpenCaseList />
            </ProtectedRoute>
          } />
          <Route path="/live-chat/:phone" element={
            <ProtectedRoute requiresProject={true}>
              <LiveChat />
            </ProtectedRoute>
          } />
          <Route path="/template" element={
            <ProtectedRoute requiresProject={true}>
              <Template />
            </ProtectedRoute>
          } />
          <Route path="/template-add" element={
            <ProtectedRoute requiresProject={true}>
              <TemplateAdd />
            </ProtectedRoute>
          } />
          <Route path="/template-edit/:templateId" element={
            <ProtectedRoute requiresProject={true}>
              <TemplateEdit />
            </ProtectedRoute>
          } />
          <Route path="/template-view/:templateId" element={
            <ProtectedRoute requiresProject={true}>
              <TemplateView />
            </ProtectedRoute>
          } />
          <Route path="/campaigns" element={
            <ProtectedRoute requiresProject={true}>
              <CampaignList />
            </ProtectedRoute>
          } />
          <Route path="/campaign/:campaignId" element={
            <ProtectedRoute requiresProject={true}>
              <CampaignDetails />
            </ProtectedRoute>
          } />
          <Route path="/create-campaign" element={
            <ProtectedRoute requiresProject={true}>
              <CreateCampaign />
            </ProtectedRoute>
          } />
          {/* Protected routes that require project - Audience */}
          <Route path="/contact" element={
            <ProtectedRoute requiresProject={true}>
              <Contact />
            </ProtectedRoute>
          } />
          <Route path="/contact-group" element={
            <ProtectedRoute requiresProject={true}>
              <ContactGroup />
            </ProtectedRoute>
          } />
          <Route path="/contact-group-list" element={
            <ProtectedRoute requiresProject={true}>
              <ContactGroupList />
            </ProtectedRoute>
          } />
          {/* Protected routes that require project - Automation */}
          <Route path="/auto-reply" element={
            <ProtectedRoute requiresProject={true}>
              <AutoReply />
            </ProtectedRoute>
          } />
          <Route path="/flow" element={
            <ProtectedRoute requiresProject={true}>
              <Flow />
            </ProtectedRoute>
          } />
          <Route path="/flows" element={
            <ProtectedRoute requiresProject={true}>
              <FlowList />
            </ProtectedRoute>
          } />
          {/* Protected routes that require project - Management */}
          <Route path="/agent-management" element={
            <ProtectedRoute requiresProject={true}>
              <AgentManagement />
            </ProtectedRoute>
          } />
          <Route path="/permission-list" element={
            <ProtectedRoute requiresProject={true}>
              <PermissionsList />
            </ProtectedRoute>
          } />
          <Route path="/project-config" element={
            <ProtectedRoute requiresProject={true}>
              <ProjectConfig />
            </ProtectedRoute>
          } />
          <Route path="/agent-config" element={
            <ProtectedRoute requiresProject={true}>
              <AgentConfig />
            </ProtectedRoute>
          } />
          <Route path="/context-config" element={
            <ProtectedRoute requiresProject={true}>
              <ContextConfig />
            </ProtectedRoute>
          } />
          <Route path="/developer-access" element={
            <ProtectedRoute requiresProject={true}>
              <DeveloperAccess />
            </ProtectedRoute>
          } />
          {/* Regular protected routes */}
          <Route path="/my-subscription" element={<MySubscription />} />
          <Route path="/my-plan" element={<Navigate to="/my-subscription" replace />} />
          <Route path="/blank" element={<Blank />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/project-details/:projectId?" element={<ProjectDetails />} />
          {/* Login related page */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/qr/:qr_id" element={<QRLanding />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/ai-bills" element={<AiBills />} />
          <Route path="/my-profile" element={<MyProfile />} />
          <Route path="/change-password" element={<Navigate to="/my-profile" replace />} />
          <Route path="/wallet-recharge/:amount?" element={<WalletRecharge />} />
          <Route path="/wallet" element={<WalletRecharge />} />
          <Route path="/payment-status/:order_id" element={<PaymentStatus />} />
          <Route path="/support" element={<Support />} />
          {/* Add more routes as needed */}
          <Route path="*" element={<Error_404 />} />
        </Routes>
        </ShellProvider>
      </BrowserRouter>
    </ThemeProvider>
  </Provider>
);
