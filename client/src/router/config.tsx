import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import ProtectedRoute from '../components/feature/ProtectedRoute';

const HomePage = lazy(() => import('../pages/home/page'));
const LoginPage = lazy(() => import('../pages/login/page'));
const LogoutPage = lazy(() => import('../pages/logout/page'));
const RefexOneSsoPage = lazy(() => import('../pages/auth/refexone/page'));
const RefexOneCallbackPage = lazy(() => import('../pages/auth/refexone/callback'));
const RefexOneLaunchPage = lazy(() => import('../pages/auth/refexone/launch'));
const DashboardPage = lazy(() => import('../pages/dashboard/page'));
const RequesterDashboardPage = lazy(() => import('../pages/requester/dashboard/page'));
const CreatePRPage = lazy(() => import('../pages/requester/create-pr/page'));
const TrackPRPage = lazy(() => import('../pages/requester/track-pr/page'));
const EvaluatePRPage = lazy(() => import('../pages/functional/evaluate-pr/page'));
const VendorMasterPage = lazy(() => import('../pages/scm/vendor-master/page'));
const ItemMasterPage = lazy(() => import('../pages/scm/item-master/page'));
const CategoryMasterPage = lazy(() => import('../pages/scm/category-master/page'));
const EntityMasterPage = lazy(() => import('../pages/scm/entity-master/page'));
const DepartmentMasterPage = lazy(() => import('../pages/scm/department-master/page'));
const RFQEntryPage = lazy(() => import('../pages/scm/rfq-entry/page'));
const RequesterRfqTaskListPage = lazy(() => import('../pages/requester/rfq-entry/page'));
const RfqEntryDetailPage = lazy(() => import('../pages/requester/rfq-entry/detail-page'));
const VendorComparisonPage = lazy(() => import('../pages/scm/vendor-comparison/page'));
const TasksPage = lazy(() => import('../pages/tasks/page'));
const RfqApprovalListPage = lazy(() => import('../pages/rfq-approval/page'));
const RfqApprovalDetailPage = lazy(() => import('../pages/rfq-approval/detail-page'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));
const SCMTechnicalClearancePage = lazy(() => import('../pages/scm/technical-clearance/page'));
const SCMPurchaseRequestsPage = lazy(() => import('../pages/scm/purchase-requests/page'));
const CreatePOPage = lazy(() => import('../pages/scm/create-po/page'));
const TrackPoPage = lazy(() => import('../pages/scm/track-po/page'));
const PoExcelImportPage = lazy(() => import('../pages/scm/po-excel-import/page'));
const PoLetterheadMasterPage = lazy(() => import('../pages/scm/po-letterhead-master/page'));
const LetterheadMasterPage = lazy(() => import('../pages/scm/letterhead-master/page'));
const POPDFViewPage = lazy(() => import('../pages/scm/po-pdf-view/page'));
const POApprovalPage = lazy(() => import('../pages/scm/po-approval/page'));
const ScmManagerDashboardPage = lazy(() => import('../pages/scm/manager-dashboard/page'));
const BuyerFinalVerifyPage = lazy(() => import('../pages/scm/buyer-final-verify/page'));
const GRNPage = lazy(() => import('../pages/grn/page'));
const AccountsDashboardPage = lazy(() => import('../pages/accounts/dashboard/page'));
const InvoiceVerificationPage = lazy(() => import('../pages/accounts/invoice-verification/page'));
const PaymentPage = lazy(() => import('../pages/accounts/payment/page'));
const SCMPaymentApprovalPage = lazy(() => import('../pages/accounts/scm-payment-approval/page'));
const PRManagerDashboardPage = lazy(() => import('../pages/pr-manager/dashboard/page'));
const CFODashboardPage = lazy(() => import('../pages/cfo/dashboard/page'));
const VendorPOAcceptancePage = lazy(() => import('../pages/scm/vendor-po-acceptance/page'));
const VendorInvoicePage = lazy(() => import('../pages/scm/vendor-invoice/page'));
const VendorQuotationPortalPage = lazy(() => import('../pages/scm/vendor-quotation-portal/page'));
const VendorSubmitQuotePage = lazy(() => import('../pages/vendor/submit-quote/page'));
const VendorPoAcceptPage = lazy(() => import('../pages/vendor/po-accept/page'));
const VendorInvoiceSubmitPage = lazy(() => import('../pages/vendor/invoice-submit/page'));
const VendorDashboardPage = lazy(() => import('../pages/vendor/dashboard/page'));
const TechEvaluatorPage = lazy(() => import('../pages/tech-evaluator/rfq-evaluation/page'));
const UserPermissionsPage = lazy(() => import('../pages/admin/user-permissions/page'));
const AdminEmailLogsPage = lazy(() => import('../pages/admin/email-logs/page'));
const AdminScmSignaturePage = lazy(() => import('../pages/admin/scm-signature/page'));
const AdminLoginPage = lazy(() => import('../pages/admin/login/page'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <ProtectedRoute><HomePage /></ProtectedRoute>,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/logout',
    element: <LogoutPage />,
  },
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },
  {
    path: '/auth/refexone',
    element: <RefexOneSsoPage />,
  },
  {
    path: '/auth/refexone/launch',
    element: <RefexOneLaunchPage />,
  },
  {
    path: '/auth/refexone/callback',
    element: <RefexOneCallbackPage />,
  },
  {
    path: '/vendor/submit-quote/:token',
    element: <VendorSubmitQuotePage />,
  },
  {
    path: '/vendor/po-accept/:token',
    element: <VendorPoAcceptPage />,
  },
  {
    path: '/vendor/invoice-submit/:token',
    element: <VendorInvoiceSubmitPage />,
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
  },
  {
    path: '/requester/dashboard',
    element: <ProtectedRoute><RequesterDashboardPage /></ProtectedRoute>,
  },
  {
    path: '/requester/create-pr',
    element: <ProtectedRoute><CreatePRPage /></ProtectedRoute>,
  },
  {
    path: '/requester/edit-pr/:prId',
    element: <ProtectedRoute><CreatePRPage /></ProtectedRoute>,
  },
  {
    path: '/requester/track-pr',
    element: <ProtectedRoute><TrackPRPage /></ProtectedRoute>,
  },
  {
    path: '/requester/po-document',
    element: <ProtectedRoute><POPDFViewPage /></ProtectedRoute>,
  },
  {
    path: '/requester/rfq-entry',
    element: <ProtectedRoute><RequesterRfqTaskListPage /></ProtectedRoute>,
  },
  {
    path: '/requester/rfq-entry/:prId',
    element: <ProtectedRoute><RfqEntryDetailPage /></ProtectedRoute>,
  },
  {
    path: '/functional/evaluate-pr',
    element: <ProtectedRoute><EvaluatePRPage /></ProtectedRoute>,
  },
  {
    path: '/scm/create-vendor',
    element: <ProtectedRoute><VendorMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/vendor-master',
    element: <ProtectedRoute><VendorMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/item-master',
    element: <ProtectedRoute><ItemMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/category-master',
    element: <ProtectedRoute><CategoryMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/entity-master',
    element: <ProtectedRoute><EntityMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/department-master',
    element: <ProtectedRoute><DepartmentMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/rfq-entry',
    element: <ProtectedRoute><RFQEntryPage /></ProtectedRoute>,
  },
  {
    path: '/scm/rfq-entry/:prId',
    element: <ProtectedRoute><RfqEntryDetailPage /></ProtectedRoute>,
  },
  {
    path: '/scm/vendor-comparison',
    element: <ProtectedRoute><VendorComparisonPage /></ProtectedRoute>,
  },
  {
    path: '/scm/technical-clearance',
    element: <SCMTechnicalClearancePage />
  },
  {
    path: '/scm/purchase-requests',
    element: <SCMPurchaseRequestsPage />
  },
  {
    path: '/scm/create-po',
    element: <ProtectedRoute><CreatePOPage /></ProtectedRoute>
  },
  {
    path: '/scm/track-po',
    element: <ProtectedRoute><TrackPoPage /></ProtectedRoute>
  },
  {
    path: '/scm/po-excel-import',
    element: <ProtectedRoute><PoExcelImportPage /></ProtectedRoute>
  },
  {
    path: '/scm/po-type-master',
    element: <ProtectedRoute><PoLetterheadMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/letterhead-master',
    element: <ProtectedRoute><LetterheadMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/po-letterhead-master',
    element: <ProtectedRoute><LetterheadMasterPage /></ProtectedRoute>,
  },
  {
    path: '/scm/po-pdf-view',
    element: <ProtectedRoute><POPDFViewPage /></ProtectedRoute>
  },
  {
    path: '/scm/manager-dashboard',
    element: <ProtectedRoute><ScmManagerDashboardPage /></ProtectedRoute>
  },
  {
    path: '/scm/po-approval',
    element: <ProtectedRoute><POApprovalPage /></ProtectedRoute>
  },
  {
    path: '/scm/buyer-final-verify',
    element: <ProtectedRoute><BuyerFinalVerifyPage /></ProtectedRoute>
  },
  {
    path: '/grn',
    element: <ProtectedRoute><GRNPage /></ProtectedRoute>
  },
  {
    path: '/accounts/dashboard',
    element: <ProtectedRoute><AccountsDashboardPage /></ProtectedRoute>
  },
  {
    path: '/accounts/invoice-verification',
    element: <ProtectedRoute><InvoiceVerificationPage /></ProtectedRoute>
  },
  {
    path: '/accounts/payment',
    element: <ProtectedRoute><PaymentPage /></ProtectedRoute>
  },
  {
    path: '/accounts/scm-payment-approval',
    element: <ProtectedRoute><SCMPaymentApprovalPage /></ProtectedRoute>
  },
  {
    path: '/pr-manager/dashboard',
    element: <ProtectedRoute><PRManagerDashboardPage /></ProtectedRoute>
  },
  {
    path: '/cfo/dashboard',
    element: <ProtectedRoute><CFODashboardPage /></ProtectedRoute>
  },
  {
    path: '/scm/vendor-po-acceptance',
    element: <ProtectedRoute><VendorPOAcceptancePage /></ProtectedRoute>
  },
  {
    path: '/requester/vendor-po-acceptance',
    element: <ProtectedRoute><VendorPOAcceptancePage /></ProtectedRoute>
  },
  {
    path: '/requester/vendor-invoice',
    element: <ProtectedRoute><VendorInvoicePage /></ProtectedRoute>
  },
  {
    path: '/scm/vendor-invoice',
    element: <ProtectedRoute><VendorInvoicePage /></ProtectedRoute>
  },
  {
    path: '/scm/vendor-quotation-portal',
    element: <ProtectedRoute><VendorQuotationPortalPage /></ProtectedRoute>
  },
  {
    path: '/vendor/dashboard',
    element: <ProtectedRoute><VendorDashboardPage /></ProtectedRoute>,
  },
  {
    path: '/tech-evaluator/rfq-evaluation',
    element: <ProtectedRoute><TechEvaluatorPage /></ProtectedRoute>,
  },
  {
    path: '/rfq-approval',
    element: <ProtectedRoute><RfqApprovalListPage /></ProtectedRoute>,
  },
  {
    path: '/rfq-approval/:prId',
    element: <ProtectedRoute><RfqApprovalDetailPage /></ProtectedRoute>,
  },
  {
    path: '/tasks',
    element: <ProtectedRoute><TasksPage /></ProtectedRoute>,
  },
  {
    path: '/admin/user-permissions',
    element: <ProtectedRoute><UserPermissionsPage /></ProtectedRoute>,
  },
  {
    path: '/admin/email-logs',
    element: <ProtectedRoute><AdminEmailLogsPage /></ProtectedRoute>,
  },
  {
    path: '/admin/scm-signature',
    element: <ProtectedRoute><AdminScmSignaturePage /></ProtectedRoute>,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export default routes;