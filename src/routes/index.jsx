/**
 * Routes Configuration
 * Centralized routing setup for the application
 */

import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "../contexts/ThemeContext";
import { UserProvider } from "../contexts/UserContext";
import { WalletBalanceProvider } from "../contexts/WalletBalanceContext";
import { LatestNotificationProvider } from "../contexts/LatestNotificationContext";
import App from "../App";
import SignUp from "../pages/SignUp";
import Verification from "../pages/Verification";
import TwoFactorSetup from "../pages/TwoFactorSetup";
import TwoFactorVerify from "../pages/TwoFactorVerify";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPasswordOTP from "../pages/ResetPasswordOTP";
import ResetPassword from "../pages/ResetPassword";
import ExchangeConnection from "../pages/ExchangeConnection";
import ExchangeAPIConfig from "../pages/ExchangeAPIConfig";
import ExchangeConnectionSuccess from "../pages/ExchangeConnectionSuccess";
import ProtectedRoute from "../components/ProtectedRoute";
import GuestRoute from "../components/GuestRoute";

// Lazy load components for better performance
import { lazy, Suspense } from "react";
import HelpSupport from "../pages/HelpSupport";
import TermsOfService from "../pages/TermsOfService";
import DataProtectionPolicy from "../pages/DataProtectionPolicy";
import ChartWebviewPage from "../pages/ChartWebviewPage";
import Dashboard from "../pages/Dashboard";
const Login = lazy(() => import("../pages/Login"));
const Profile = lazy(() => import("../pages/Profile"));
const Markets = lazy(() => import("../pages/Markets"));
const CryptoMarketsPage = lazy(() => import("../pages/CryptoMarketsPage"));
const ForexMarketsPage = lazy(() => import("../pages/ForexMarketsPage"));
const IndianMarketsPage = lazy(() => import("../pages/IndianMarketsPage"));
const DepositCrypto = lazy(() => import("../pages/DepositCrypto"));
const DepositFiat = lazy(() => import("../pages/DepositFiat"));
const PayThroughDeposit = lazy(() => import("../pages/PayThroughDeposit"));
const PaymentSuccess = lazy(() => import("../pages/PaymentSuccess"));
const PaymentFailed = lazy(() => import("../pages/PaymentFailed"));
const P2PTrading = lazy(() => import("../pages/P2PTrading"));
const Wallet = lazy(() => import("../pages/Wallet"));
const Orders = lazy(() => import("../pages/Orders"));
const Landing = lazy(() => import("../pages/Landing"));

// Root layout: providers must wrap route outlet for context to work with createBrowserRouter
const RootLayout = () => (
  <ThemeProvider>
    <UserProvider>
      <WalletBalanceProvider>
        <LatestNotificationProvider>
          <Outlet />
        </LatestNotificationProvider>
      </WalletBalanceProvider>
    </UserProvider>
  </ThemeProvider>
);

// Loading component
const LoadingFallback = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "var(--bg-primary)",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "3px solid var(--border-light)",
          borderTopColor: "var(--brand-primary)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto",
        }}
      ></div>
      <p
        className="text-body-md text-secondary"
        style={{ marginTop: "var(--space-md)" }}
      >
        Loading...
      </p>
    </div>
  </div>
);

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <Navigate to="/" replace />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <GuestRoute>
              <Login />
            </GuestRoute>
          </Suspense>
        ),
      },
      {
        element: <App />,
        children: [
          {
            path: "signup",
            element: (
              <GuestRoute>
                <SignUp />
              </GuestRoute>
            ),
          },
          {
            path: "verify",
            element: (
              <GuestRoute>
                <Verification />
              </GuestRoute>
            ),
          },
          {
            path: "2fa-setup",
            element: (
              <GuestRoute>
                <TwoFactorSetup />
              </GuestRoute>
            ),
          },
          {
            path: "2fa-verify",
            element: (
              <GuestRoute>
                <TwoFactorVerify />
              </GuestRoute>
            ),
          },
          {
            path: "login",
            element: (
              <GuestRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <Login />
                </Suspense>
              </GuestRoute>
            ),
          },
          {
            path: "forgot-password",
            element: (
              <GuestRoute>
                <ForgotPassword />
              </GuestRoute>
            ),
          },
          {
            path: "reset-password-otp",
            element: (
              <GuestRoute>
                <ResetPasswordOTP />
              </GuestRoute>
            ),
          },
          {
            path: "reset-password",
            element: (
              <GuestRoute>
                <ResetPassword />
              </GuestRoute>
            ),
          },
          {
            path: "exchange-connection",
            element: <ExchangeConnection />,
          },
          {
            path: "exchange-api-config",
            element: <ExchangeAPIConfig />,
          },
          {
            path: "exchange-connection-success",
            element: <ExchangeConnectionSuccess />,
          },
          // {
          //   path: "markets",
          //   element: (
          //     <Suspense fallback={<LoadingFallback />}>
          //       <Markets />
          //     </Suspense>
          //   ),
          // },
          {
            path: "markets/crypto",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <CryptoMarketsPage />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "markets/forex",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <ForexMarketsPage />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "markets/indian",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <IndianMarketsPage />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "markets/commodities",
            element: <Navigate to="/markets/forex" replace />,
          },
          {
            path: "markets/metals",
            element: <Navigate to="/markets/forex" replace />,
          },
          {
            path: "markets/indices",
            element: <Navigate to="/markets/forex" replace />,
          },
          // {
          //   path: "markets/indices",
          //   element: (
          //     <Suspense fallback={<LoadingFallback />}>
          //       <ProtectedRoute>
          //         <IndicesMarketsPage />
          //       </ProtectedRoute>
          //     </Suspense>
          //   ),
          // },
          {
            path: "dashboard",
            element: (
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <Dashboard />
                </Suspense>
              </ProtectedRoute>
            ),
          },
          {
            path: "profile",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "profile/verification",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "profile/security",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "profile/exchanges",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "profile/notifications",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "deposit-crypto",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <DepositCrypto />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "deposit-fiat",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <DepositFiat />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "pay-through-deposit",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <PayThroughDeposit />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "payment/success",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <PaymentSuccess />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "payment/failed",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <PaymentFailed />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "p2p-trading",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <P2PTrading />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "wallet",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "orders",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "helpsupport",
            element: (
              <Suspense fallback={<LoadingFallback />}>
                <ProtectedRoute>
                  <HelpSupport />
                </ProtectedRoute>
              </Suspense>
            ),
          },
          {
            path: "terms",
            element: <TermsOfService />,
          },
          {
            path: "data-policy",
            element: <DataProtectionPolicy />,
          },
          {
            path: "webview/crypto-chart",
            element: <ChartWebviewPage />,
          },
          {
            path: "webview/crypto-chart/:pairSymbol",
            element: <ChartWebviewPage />,
          },
          {
            path: "*",
            element: <Navigate to="/signup" replace />,
          },
        ],
      },
    ],
  },
]);

export default router;
