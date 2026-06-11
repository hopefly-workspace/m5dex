/**
 * P2P Trading Page
 * Screen for peer-to-peer cryptocurrency trading
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatTimer } from '../utils/formatTime';
import '../styles/pages/P2PTrading.css';

// Fiat currencies
const fiatCurrencies = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
];

// Cryptocurrencies
const cryptocurrencies = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 15 23"
        fill="none"
      >
        <path
          d="M11.9255 10.6163C12.5592 9.99429 13.0045 9.19907 13.2084 8.32548C13.4122 7.45189 13.366 6.53679 13.0753 5.6893C12.7845 4.84181 12.2615 4.09768 11.5685 3.54563C10.8755 2.99359 10.0419 2.65692 9.1669 2.57578V0.851852C9.1669 0.625927 9.07911 0.409255 8.92283 0.249502C8.76656 0.0897484 8.55461 0 8.3336 0C8.1126 0 7.90064 0.0897484 7.74437 0.249502C7.5881 0.409255 7.5003 0.625927 7.5003 0.851852V2.55545L5.8337 2.55529V0.851852C5.8337 0.625927 5.74591 0.409255 5.58964 0.249502C5.43336 0.0897484 5.22141 0 5.00041 0C4.7794 0 4.56745 0.0897484 4.41117 0.249502C4.2549 0.409255 4.16711 0.625927 4.16711 0.851852V2.55519L2.5 2.55504H0.833299C0.612294 2.55504 0.400341 2.64478 0.244067 2.80454C0.0877935 2.96429 0 3.18096 0 3.40689C0 3.63281 0.0877935 3.84948 0.244067 4.00924C0.400341 4.16899 0.612294 4.25874 0.833299 4.25874H1.6666V18.7402H0.833299C0.612294 18.7402 0.400341 18.83 0.244067 18.9897C0.0877935 19.1495 0 19.3661 0 19.5921C0 19.818 0.0877935 20.0347 0.244067 20.1944C0.400341 20.3542 0.612294 20.4439 0.833299 20.4439H2.49979L4.16711 20.444V22.1481C4.16711 22.3741 4.2549 22.5907 4.41117 22.7505C4.56745 22.9103 4.7794 23 5.00041 23C5.22141 23 5.43336 22.9103 5.58964 22.7505C5.74591 22.5907 5.8337 22.3741 5.8337 22.1481V20.4441L7.5003 20.4443V22.1481C7.5003 22.3741 7.5881 22.5907 7.74437 22.7505C7.90064 22.9103 8.1126 23 8.3336 23C8.55461 23 8.76656 22.9103 8.92283 22.7505C9.07911 22.5907 9.1669 22.3741 9.1669 22.1481V20.4444L10.0002 20.4444C11.1558 20.4444 12.2758 20.0352 13.1695 19.2864C14.0633 18.5375 14.6757 17.4953 14.9027 16.3369C15.1296 15.1786 14.957 13.9756 14.4142 12.9327C13.8714 11.8898 12.992 11.0712 11.9255 10.6163ZM11.6668 7.24074C11.6659 8.03121 11.3584 8.78904 10.8116 9.34799C10.2648 9.90693 9.5235 10.2213 8.75025 10.2222H3.3332V4.25884L4.99481 4.25895C4.99669 4.259 4.99852 4.25926 5.00041 4.25926C5.00229 4.25926 5.00412 4.259 5.006 4.25895L8.33299 4.25921L8.3336 4.25926L8.33421 4.25921L8.75025 4.25926C9.5235 4.26015 10.2648 4.57455 10.8116 5.13349C11.3584 5.69244 11.6659 6.45027 11.6668 7.24074ZM10.0003 18.7407L3.3332 18.7403V11.9259H10.0002C10.8842 11.9259 11.732 12.2849 12.3571 12.9239C12.9822 13.5629 13.3334 14.4296 13.3334 15.3333C13.3335 16.237 12.9823 17.1037 12.3572 17.7427C11.7321 18.3817 10.8843 18.7407 10.0003 18.7407Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 15 24"
        fill="none"
      >
        <path
          d="M7.1542 0.5L0.500061 12.1824L7.1542 16.3621L13.7925 12.1428L7.1542 0.5Z"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.15421 23.5001V18.4242"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.1542 23.5L0.500061 14.2445L7.1542 18.4241L13.7925 14.2048L7.1542 23.5Z"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.1542 9.06555L0.500061 12.1824L7.1542 16.3621L13.7925 12.1428L7.1542 9.06555Z"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.15421 0.5V16.3621"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.1542 0.5L0.500061 12.1824L7.1542 16.3621L13.7925 12.1428L7.1542 0.5Z"
          stroke="currentColor"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 25 23"
        fill="none"
      >
        <path
          d="M25 10.8697C25 9.30262 20.7106 7.99513 15.0105 7.69347L15.0101 5.19653H22.1273V0H2.66585V5.19653H9.78253V7.70568C4.18624 8.02802 0 9.32187 0 10.8697C0 12.4178 4.18624 13.7118 9.78253 14.0336V23H15.0101V14.0458C20.7106 13.7448 25 12.4369 25 10.8697ZM12.4999 12.4135C6.38166 12.4135 1.42168 11.4722 1.42168 10.3102C1.42168 9.32638 4.97824 8.50041 9.78253 8.2706V8.86279H9.78308V11.2895C10.6492 11.3378 11.5595 11.3631 12.4999 11.3631C13.3659 11.3631 14.2068 11.3413 15.0106 11.3012V8.26157C19.9191 8.47731 23.5784 9.31197 23.5784 10.3102C23.5783 11.4722 18.6182 12.4135 12.4999 12.4135Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    symbol: 'BNB',
    name: 'Binance Coin',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 25 23"
        fill="none"
      >
        <path
          d="M17.7269 9.29257L12.6775 4.24323C12.5337 4.0995 12.3388 4.01876 12.1355 4.01876C11.9322 4.01876 11.7372 4.0995 11.5934 4.24323L6.5441 9.29257C6.40032 9.4363 6.20535 9.51705 6.00205 9.51705C5.79876 9.51705 5.60379 9.4363 5.46001 9.29257L4.37593 8.20849C4.2322 8.06472 4.15146 7.86975 4.15146 7.66645C4.15146 7.46315 4.2322 7.26818 4.37593 7.12441L11.0514 0.448946C11.3389 0.161486 11.7289 0 12.1355 0C12.5421 0 12.932 0.161486 13.2196 0.448946L19.895 7.12441C20.0388 7.26818 20.1195 7.46315 20.1195 7.66645C20.1195 7.86975 20.0388 8.06472 19.895 8.20849L18.8109 9.29257C18.6672 9.4363 18.4722 9.51705 18.2689 9.51705C18.0656 9.51705 17.8706 9.4363 17.7269 9.29257Z"
          fill="currentColor"
        />
        <path
          d="M12.1355 23C11.9341 23.0002 11.7347 22.9607 11.5486 22.8836C11.3626 22.8065 11.1936 22.6934 11.0514 22.5508L4.37593 15.8753C4.2322 15.7315 4.15146 15.5366 4.15146 15.3333C4.15146 15.13 4.2322 14.935 4.37593 14.7912L5.46001 13.7071C5.60379 13.5634 5.79876 13.4827 6.00205 13.4827C6.20535 13.4827 6.40032 13.5634 6.5441 13.7071L11.5934 18.7565C11.7372 18.9002 11.9322 18.981 12.1355 18.981C12.3388 18.981 12.5337 18.9002 12.6775 18.7565L17.7269 13.7071C17.8706 13.5634 18.0656 13.4827 18.2689 13.4827C18.4722 13.4827 18.6672 13.5634 18.8109 13.7071L19.895 14.7912C20.0388 14.935 20.1195 15.13 20.1195 15.3333C20.1195 15.5366 20.0388 15.7315 19.895 15.8753L13.2196 22.5508C13.0774 22.6934 12.9084 22.8065 12.7223 22.8836C12.5363 22.9607 12.3369 23.0002 12.1355 23Z"
          fill="currentColor"
        />
        <path
          d="M13.762 10.9574L12.6777 9.87318C12.3783 9.57377 11.8929 9.57377 11.5935 9.87318L10.5093 10.9574C10.2098 11.2568 10.2098 11.7423 10.5093 12.0417L11.5935 13.1259C11.8929 13.4253 12.3783 13.4253 12.6777 13.1259L13.762 12.0417C14.0614 11.7423 14.0614 11.2568 13.762 10.9574Z"
          fill="currentColor"
        />
        <path
          d="M3.79486 10.9579L2.71061 9.87367C2.4112 9.57426 1.92577 9.57426 1.62636 9.87367L0.542119 10.9579C0.242712 11.2573 0.242712 11.7428 0.542118 12.0422L1.62636 13.1264C1.92577 13.4258 2.4112 13.4258 2.71061 13.1264L3.79486 12.0422C4.09426 11.7428 4.09426 11.2573 3.79486 10.9579Z"
          fill="currentColor"
        />
        <path
          d="M23.7283 10.9578L22.6441 9.87354C22.3447 9.57414 21.8592 9.57414 21.5598 9.87354L20.4756 10.9578C20.1762 11.2572 20.1762 11.7426 20.4756 12.042L21.5598 13.1263C21.8592 13.4257 22.3447 13.4257 22.6441 13.1263L23.7283 12.042C24.0277 11.7426 24.0277 11.2572 23.7283 10.9578Z"
          fill="currentColor"
        />
      </svg>
    )
  },
];

// Payment methods
const paymentMethods = [
  {
    id: 'all',
    name: 'All Methods',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 23 23"
        fill="none"
      >
        <path
          d="M15.1924 11.931C16.1168 10.2231 16.3954 8.23958 15.9773 6.34315C15.5592 4.44673 14.4724 2.7642 12.9156 1.60332C11.3588 0.442444 9.43615 -0.119192 7.49927 0.0211461C5.56239 0.161484 3.74076 0.994417 2.36759 2.36759C0.994417 3.74076 0.161484 5.56239 0.021146 7.49927C-0.119192 9.43615 0.442444 11.3588 1.60333 12.9156C2.76421 14.4724 4.44673 15.5592 6.34316 15.9773C8.23958 16.3954 10.2231 16.1168 11.931 15.1924L19.1103 22.38C19.5088 22.7771 20.0484 23 20.611 23C21.1735 23 21.7131 22.7771 22.1116 22.38L22.3717 22.1199C22.5693 21.9231 22.7261 21.6893 22.8331 21.4317C22.9401 21.1742 22.9952 20.8981 22.9952 20.6192C22.9952 20.3404 22.9401 20.0642 22.8331 19.8067C22.7261 19.5492 22.5693 19.3153 22.3717 19.1186L15.1924 11.931ZM8.0957 1.68429C9.3654 1.68429 10.6066 2.0608 11.6623 2.7662C12.718 3.4716 13.5408 4.47422 14.0267 5.64726C14.5126 6.8203 14.6397 8.11108 14.392 9.35638C14.1443 10.6017 13.5329 11.7455 12.6351 12.6434C11.7373 13.5412 10.5934 14.1526 9.34812 14.4003C8.10283 14.648 6.81204 14.5209 5.639 14.035C4.46596 13.5491 3.46334 12.7262 2.75794 11.6705C2.05254 10.6148 1.67603 9.37365 1.67603 8.10396C1.67822 6.40203 2.35528 4.77043 3.55872 3.56698C4.76217 2.36353 6.39377 1.68647 8.0957 1.68429ZM21.2034 20.9516L20.9433 21.2117C20.8999 21.2557 20.8482 21.2907 20.7911 21.3146C20.7341 21.3385 20.6728 21.3508 20.611 21.3508C20.5491 21.3508 20.4879 21.3385 20.4308 21.3146C20.3738 21.2907 20.322 21.2557 20.2786 21.2117L13.314 14.247C13.6485 13.9662 13.9579 13.6568 14.2388 13.3223L21.2034 20.2869C21.2479 20.3304 21.2833 20.3825 21.3074 20.4399C21.3315 20.4973 21.3439 20.559 21.3438 20.6213C21.344 20.683 21.3317 20.7441 21.3076 20.8009C21.2835 20.8577 21.248 20.9089 21.2034 20.9516Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 21 23"
        fill="none"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.72586 8.87897C5.59601 8.87897 6.29885 9.58208 6.29885 10.448V15.6787C6.29885 16.5445 5.59601 17.2477 4.72586 17.2477C3.8557 17.2477 3.14992 16.5445 3.14992 15.6787V10.448C3.14992 9.58208 3.8557 8.87897 4.72586 8.87897ZM4.72586 9.92531C4.43549 9.92531 4.20121 10.1597 4.20121 10.448V15.6787C4.20121 15.9669 4.43548 16.2013 4.72586 16.2013C5.01623 16.2013 5.25051 15.967 5.25051 15.6787V10.448C5.25051 10.1597 5.01623 9.92531 4.72586 9.92531ZM8.3994 8.87897C9.27054 8.87897 9.97534 9.58208 9.97534 10.448V15.6787C9.97534 16.5445 9.27054 17.2477 8.3994 17.2477C7.52925 17.2477 6.82642 16.5445 6.82642 15.6787V10.448C6.82642 9.58208 7.52925 8.87897 8.3994 8.87897ZM8.3994 9.92531C8.11002 9.92531 7.87476 10.1597 7.87476 10.448V15.6787C7.87476 15.9669 8.11001 16.2013 8.3994 16.2013C8.68978 16.2013 8.92405 15.967 8.92405 15.6787V10.448C8.92405 10.1597 8.68978 9.92531 8.3994 9.92531ZM12.6006 8.87897C13.4708 8.87897 14.1746 9.58208 14.1746 10.448V15.6787C14.1746 16.5445 13.4708 17.2477 12.6006 17.2477C11.7305 17.2477 11.0247 16.5445 11.0247 15.6787V10.448C11.0247 9.58208 11.7305 8.87897 12.6006 8.87897ZM12.6006 9.92531C12.3103 9.92531 12.076 10.1597 12.076 10.448V15.6787C12.076 15.9669 12.3103 16.2013 12.6006 16.2013C12.891 16.2013 13.1253 15.967 13.1253 15.6787V10.448C13.1253 10.1597 12.891 9.92531 12.6006 9.92531ZM16.2752 8.87897C17.1453 8.87897 17.8511 9.58208 17.8511 10.448V15.6787C17.8511 16.5445 17.1453 17.2477 16.2752 17.2477C15.404 17.2477 14.7012 16.5445 14.7012 15.6787V10.448C14.7012 9.58208 15.404 8.87897 16.2752 8.87897ZM16.2752 9.92531C15.9848 9.92531 15.7505 10.1597 15.7505 10.448V15.6787C15.7505 15.9669 15.9848 16.2013 16.2752 16.2013C16.5646 16.2013 16.7998 15.967 16.7998 15.6787V10.448C16.7998 10.1597 16.5646 9.92531 16.2752 9.92531ZM-1.05682e-05 21.431C-1.05682e-05 20.5651 0.70577 19.862 1.57593 19.862H2.10057V19.3393C2.10057 18.9225 2.26496 18.5244 2.56222 18.2302C2.85753 17.936 3.25913 17.7703 3.67651 17.7703H17.3234C17.7418 17.7703 18.1434 17.9361 18.4377 18.2302C18.735 18.5244 18.8994 18.9225 18.8994 19.3393V19.862H19.424C20.2951 19.862 20.9999 20.5651 20.9999 21.431C20.9999 22.2979 20.2951 23 19.424 23H1.57588C0.70572 23 -1.05682e-05 22.2979 -1.05682e-05 21.431ZM1.05128 21.431C1.05128 21.7203 1.28555 21.9546 1.57593 21.9546H19.4241C19.7144 21.9546 19.9487 21.7203 19.9487 21.431C19.9487 21.1427 19.7144 20.9083 19.4241 20.9083H1.57593C1.28555 20.9083 1.05128 21.1427 1.05128 21.431ZM17.8511 19.862V19.3393C17.8511 19.2011 17.795 19.0677 17.6956 18.9696C17.5981 18.8716 17.4633 18.8166 17.3235 18.8166H3.67659C3.5378 18.8166 3.40295 18.8716 3.30548 18.9696C3.20508 19.0677 3.14995 19.201 3.14995 19.3393V19.862H17.8511ZM9.6092 0.275059C10.1457 -0.0916863 10.8554 -0.0916863 11.3918 0.275059L20.4253 6.44814C20.8052 6.70702 20.9706 7.18264 20.8338 7.62C20.6989 8.05737 20.2924 8.35645 19.8307 8.35645H1.17042C0.707786 8.35645 0.302229 8.05737 0.167363 7.62C0.0305384 7.18264 0.194926 6.70704 0.575868 6.44814L9.6092 0.275059ZM1.17047 7.30997H19.8308L10.7973 1.13688C10.6192 1.01528 10.382 1.01528 10.2028 1.13688L1.17047 7.30997ZM10.5 2.60296C11.6586 2.60296 12.6006 3.54044 12.6006 4.69561C12.6006 5.84981 11.6586 6.78728 10.5 6.78728C9.34239 6.78728 8.3994 5.84979 8.3994 4.69561C8.3994 3.54042 9.34241 2.60296 10.5 2.60296ZM10.5 3.64929C9.92021 3.64929 9.45067 4.11804 9.45067 4.69563C9.45067 5.27225 9.92021 5.74099 10.5 5.74099C11.0808 5.74099 11.5493 5.27225 11.5493 4.69563C11.5493 4.11804 11.0808 3.64929 10.5 3.64929Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    id: 'paypal',
    name: 'PayPal',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 23 16"
        fill="none"
      >
        <path
          d="M20.2449 0H2.75507C2.02458 0.000652515 1.3242 0.291128 0.807662 0.807662C0.291128 1.3242 0.000652515 2.02458 0 2.75507V12.8521C0.000652515 13.5826 0.291128 14.2829 0.807662 14.7995C1.3242 15.316 2.02458 15.6065 2.75507 15.6071H20.2449C20.9754 15.6065 21.6758 15.316 22.1923 14.7995C22.7089 14.2829 22.9993 13.5826 23 12.8521V2.75507C22.9993 2.02458 22.7089 1.3242 22.1923 0.807662C21.6758 0.291128 20.9754 0.000652515 20.2449 0ZM21.3571 12.8521C21.3569 13.147 21.2397 13.4298 21.0311 13.6383C20.8226 13.8468 20.5398 13.9641 20.2449 13.9643H2.75507C2.46016 13.9641 2.17739 13.8468 1.96886 13.6383C1.76032 13.4298 1.64307 13.147 1.64286 12.8521V5.75H21.3571V12.8521ZM21.3571 4.10714H1.64286V2.75507C1.64307 2.46016 1.76032 2.17739 1.96886 1.96886C2.17739 1.76032 2.46016 1.64307 2.75507 1.64286H20.2449C20.5398 1.64307 20.8226 1.76032 21.0311 1.96886C21.2397 2.17739 21.3569 2.46016 21.3571 2.75507V4.10714Z"
          fill="currentColor"
        />
        <path
          d="M18.8928 9.03577H17.25C16.7963 9.03577 16.4286 9.40353 16.4286 9.8572V11.5001C16.4286 11.9537 16.7963 12.3215 17.25 12.3215H18.8928C19.3465 12.3215 19.7143 11.9537 19.7143 11.5001V9.8572C19.7143 9.40353 19.3465 9.03577 18.8928 9.03577Z"
          fill="currentColor"
        />
        <path
          d="M4.10713 11.5H7.39285C7.6107 11.5 7.81964 11.4135 7.97369 11.2594C8.12773 11.1054 8.21428 10.8965 8.21428 10.6786C8.21428 10.4607 8.12773 10.2518 7.97369 10.0978C7.81964 9.94372 7.6107 9.85718 7.39285 9.85718H4.10713C3.88928 9.85718 3.68034 9.94372 3.5263 10.0978C3.37225 10.2518 3.28571 10.4607 3.28571 10.6786C3.28571 10.8965 3.37225 11.1054 3.5263 11.2594C3.68034 11.4135 3.88928 11.5 4.10713 11.5Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    id: 'upi',
    name: 'UPI',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 15 23"
        fill="none"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M15 2.3C15 1.68973 14.763 1.10477 14.3407 0.6739C13.9193 0.242267 13.347 0 12.75 0C10.1528 0 4.84725 0 2.25 0C1.653 0 1.08075 0.242267 0.65925 0.6739C0.237 1.10477 0 1.68973 0 2.3C0 6.2514 0 16.7486 0 20.7C0 21.3103 0.237 21.8952 0.65925 22.3261C1.08075 22.7577 1.653 23 2.25 23C4.84725 23 10.1528 23 12.75 23C13.347 23 13.9193 22.7577 14.3407 22.3261C14.763 21.8952 15 21.3103 15 20.7V2.3ZM3.95925 1.53333H2.25C2.05125 1.53333 1.86 1.61383 1.71975 1.75797C1.57875 1.90133 1.5 2.09683 1.5 2.3V20.7C1.5 20.9032 1.57875 21.0987 1.71975 21.242C1.86 21.3862 2.05125 21.4667 2.25 21.4667H12.75C12.9487 21.4667 13.14 21.3862 13.2803 21.242C13.4213 21.0987 13.5 20.9032 13.5 20.7V2.3C13.5 2.09683 13.4213 1.90133 13.2803 1.75797C13.14 1.61383 12.9487 1.53333 12.75 1.53333H11.0408L10.6327 2.78453C10.428 3.4109 9.855 3.83333 9.20925 3.83333H5.79075C5.145 3.83333 4.572 3.4109 4.36725 2.78453L3.95925 1.53333ZM6.75 20.7H8.25C8.664 20.7 9 20.3565 9 19.9333C9 19.5101 8.664 19.1667 8.25 19.1667H6.75C6.336 19.1667 6 19.5101 6 19.9333C6 20.3565 6.336 20.7 6.75 20.7ZM5.54025 1.53333L5.79075 2.3H9.20925L9.45975 1.53333H5.54025Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    id: 'wise',
    name: 'Wise',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 24 23"
        fill="none"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M0 9.90125C0 10.1807 0.15556 10.4353 0.403266 10.5631C3.34206 12.0712 7.33211 13.0085 11.7274 13.0085C16.1227 13.0085 20.1128 12.0712 23.0516 10.5631C23.2993 10.4353 23.4548 10.1807 23.4548 9.90125V6.85446C23.4548 5.65952 22.2817 4.58447 20.7301 4.58447C16.5557 4.58447 6.89912 4.58447 2.72477 4.58447C1.17314 4.58447 0 5.65952 0 6.85446V9.90125ZM21.9686 9.44051V6.85446C21.9686 6.65827 21.8447 6.49181 21.6773 6.36301C21.4355 6.17673 21.0987 6.07071 20.7301 6.07071C16.5557 6.07071 6.89912 6.07071 2.72477 6.07071C2.35618 6.07071 2.0193 6.17673 1.77754 6.36301C1.61009 6.49181 1.48624 6.65827 1.48624 6.85446V9.44051C4.20407 10.7395 7.79483 11.5222 11.7274 11.5222C15.66 11.5222 19.2508 10.7395 21.9686 9.44051Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M23.4548 7.30924C23.4548 5.80418 22.2351 4.58447 20.7301 4.58447C16.5557 4.58447 6.89912 4.58447 2.72477 4.58447C1.21971 4.58447 0 5.80418 0 7.30924C0 10.5671 0 17.0174 0 20.2752C0 21.7803 1.21971 23 2.72477 23C6.89912 23 16.5557 23 20.7301 23C22.2351 23 23.4548 21.7803 23.4548 20.2752V7.30924ZM21.9686 7.30924C21.9686 6.62557 21.4137 6.07071 20.7301 6.07071C16.5557 6.07071 6.89912 6.07071 2.72477 6.07071C2.0411 6.07071 1.48624 6.62557 1.48624 7.30924C1.48624 10.5671 1.48624 17.0174 1.48624 20.2752C1.48624 20.9589 2.0411 21.5137 2.72477 21.5137C6.89912 21.5137 16.5557 21.5137 20.7301 21.5137C21.4137 21.5137 21.9686 20.9589 21.9686 20.2752V7.30924Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.25035 17.9606H14.2045C14.6147 17.9606 14.9476 17.6277 14.9476 17.2175C14.9476 16.8073 14.6147 16.4744 14.2045 16.4744H9.25035C8.84015 16.4744 8.50723 16.8073 8.50723 17.2175C8.50723 17.6277 8.84015 17.9606 9.25035 17.9606Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M18.4155 7.68485V2.72477C18.4155 1.21971 17.1958 0 15.6907 0C13.4911 0 9.96374 0 7.76411 0C6.25904 0 5.03934 1.21971 5.03934 2.72477C5.03934 4.77677 5.03934 7.68485 5.03934 7.68485C5.03934 8.09505 5.37225 8.42797 5.78246 8.42797C6.19266 8.42797 6.52558 8.09505 6.52558 7.68485C6.52558 7.68485 6.52558 4.77677 6.52558 2.72477C6.52558 2.0411 7.08044 1.48624 7.76411 1.48624C9.96374 1.48624 13.4911 1.48624 15.6907 1.48624C16.3744 1.48624 16.9292 2.0411 16.9292 2.72477C16.9292 4.77677 16.9292 7.68485 16.9292 7.68485C16.9292 8.09505 17.2622 8.42797 17.6724 8.42797C18.0826 8.42797 18.4155 8.09505 18.4155 7.68485Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    id: 'cash',
    name: 'Cash',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={16}
        height={16}
        viewBox="0 0 27 16"
        fill="none"
      >
        <rect
          x="0.699994"
          y="0.700024"
          width="25.4"
          height="14.4"
          rx="2.7"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M9.78725 4.0385C9.78725 3.68032 9.50574 3.40002 9.14877 3.40002H5.31543C4.95725 3.40002 4.67695 3.68153 4.67695 4.0385C4.67695 4.39669 4.39544 4.67698 4.03847 4.67698C3.68029 4.67698 3.39999 4.9585 3.39999 5.31546V10.427C3.39999 10.7852 3.6815 11.0655 4.03847 11.0655C4.39666 11.0655 4.67695 11.347 4.67695 11.7039C4.67695 12.0621 4.95846 12.3424 5.31543 12.3424H9.14877C9.50695 12.3424 9.78725 12.0609 9.78725 11.7039C9.78725 11.3458 9.50574 11.0655 9.14877 11.0655H5.83891C5.64725 10.5156 5.21239 10.0939 4.67573 9.90228V5.85213C5.22558 5.66046 5.64725 5.22561 5.83891 4.68894H9.14877C9.50695 4.68894 9.78725 4.40743 9.78725 4.05046V4.0385Z"
          fill="currentColor"
        />
        <path
          d="M6.5924 7.23218C6.23421 7.23218 5.95392 7.51369 5.95392 7.87066C5.95392 8.22884 6.23543 8.50914 6.5924 8.50914H6.84755C7.20574 8.50914 7.48603 8.22763 7.48603 7.87066C7.48603 7.51247 7.20452 7.23218 6.84755 7.23218H6.5924Z"
          fill="currentColor"
        />
        <circle cx="13.4" cy="7.87122" r={2} fill="currentColor" />
        <path
          d="M17.0127 11.7039C17.0127 12.0621 17.2943 12.3424 17.6512 12.3424L21.4846 12.3424C21.8427 12.3424 22.123 12.0609 22.123 11.7039C22.123 11.3457 22.4045 11.0654 22.7615 11.0654C23.1197 11.0654 23.4 10.7839 23.4 10.427L23.4 5.31545C23.4 4.95726 23.1185 4.67697 22.7615 4.67697C22.4033 4.67697 22.123 4.39546 22.123 4.03849C22.123 3.6803 21.8415 3.40001 21.4846 3.40001L17.6512 3.40001C17.293 3.40001 17.0127 3.68152 17.0127 4.03849C17.0127 4.39667 17.2943 4.67697 17.6512 4.67697L20.9611 4.67697C21.1527 5.22682 21.5876 5.64849 22.1243 5.84015L22.1243 9.8903C21.5744 10.082 21.1527 10.5168 20.9611 11.0535L17.6512 11.0535C17.293 11.0535 17.0127 11.335 17.0127 11.692L17.0127 11.7039Z"
          fill="currentColor"
        />
        <path
          d="M20.2076 8.51025C20.5658 8.51025 20.8461 8.22874 20.8461 7.87177C20.8461 7.51359 20.5646 7.23329 20.2076 7.23329L19.9524 7.23329C19.5942 7.23329 19.314 7.5148 19.314 7.87177C19.314 8.22996 19.5955 8.51025 19.9524 8.51025L20.2076 8.51025Z"
          fill="currentColor"
        />
      </svg>
    )
  },
];

const P2PTrading = () => {
  const navigate = useNavigate();
  const [tradeType, setTradeType] = useState('buy'); // 'buy' or 'sell'
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');
  const [selectedFiat, setSelectedFiat] = useState('USD');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [showCryptoDropdown, setShowCryptoDropdown] = useState(false);
  const [showFiatDropdown, setShowFiatDropdown] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [activeTrade, setActiveTrade] = useState(null);
  const [showTradeHistory, setShowTradeHistory] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [timer, setTimer] = useState(0);
  // Mock offers data
  const [offers] = useState([
    {
      id: '1',
      advertiser: 'CryptoTrader123',
      completionRate: 98.5,
      trades: 1234,
      online: true,
      rating: 4.9,
      price: 42850.00,
      available: 0.5,
      minAmount: 100,
      maxAmount: 5000,
      paymentMethods: ['bank', 'paypal'],
      paymentWindow: 30,
    },
    {
      id: '2',
      advertiser: 'BitcoinPro',
      completionRate: 99.2,
      trades: 2341,
      online: true,
      rating: 4.8,
      price: 42880.00,
      available: 1.2,
      minAmount: 200,
      maxAmount: 10000,
      paymentMethods: ['bank', 'upi'],
      paymentWindow: 15,
    },
    {
      id: '3',
      advertiser: 'CryptoMaster',
      completionRate: 97.8,
      trades: 856,
      online: false,
      rating: 4.7,
      price: 42830.00,
      available: 0.3,
      minAmount: 50,
      maxAmount: 3000,
      paymentMethods: ['paypal', 'wise'],
      paymentWindow: 45,
    },
  ]);
  // Mock active trades
  const [activeTrades] = useState([
    {
      id: 'P2P-ORDER-123456',
      status: 'waiting_payment',
      timer: 1728, // seconds
      advertiser: 'CryptoTrader123',
      rate: 42850.00,
      paymentMethod: 'bank',
      amount: 0.02334,
      price: 1000.00,
      orderTime: '2025-12-29 14:30:00',
      paymentInstructions: {
        bank: 'Chase Bank',
        account: 'XXXX-XXXX-1234',
        name: 'John Doe',
        reference: 'P2P-ORDER-123456',
      },
    },
  ]);
  // Mock trade history
  const [tradeHistory] = useState([
    {
      id: 'P2P-123456',
      date: '2025-12-29',
      time: '14:30',
      type: 'Buy',
      amount: '0.02334 BTC',
      fiat: '$1,000',
      counterparty: 'CryptoTrader123',
      status: 'Completed',
    },
    {
      id: 'P2P-123457',
      date: '2025-12-28',
      time: '10:15',
      type: 'Sell',
      amount: '0.5 BTC',
      fiat: '$21,425',
      counterparty: 'BitcoinPro',
      status: 'Completed',
    },
  ]);

  const selectedCryptoData = cryptocurrencies.find(c => c.symbol === selectedCrypto);
  const selectedFiatData = fiatCurrencies.find(f => f.code === selectedFiat);
  const selectedPaymentData = paymentMethods.find(p => p.id === selectedPaymentMethod);

  // Filter offers
  const filteredOffers = offers.filter(offer => {
    // Filter by payment method
    if (selectedPaymentMethod !== 'all' && !offer.paymentMethods.includes(selectedPaymentMethod)) {
      return false;
    }
    // Add more filtering logic here if offers have crypto/fiat fields
    return true;
  });

  // Close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.crypto-dropdown') &&
        !event.target.closest('.fiat-dropdown') &&
        !event.target.closest('.payment-dropdown')) {
        setShowCryptoDropdown(false);
        setShowFiatDropdown(false);
        setShowPaymentDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get filter labels
  const getFilterLabel = (key, value) => {
    if (key === 'tradeType') {
      return value === 'buy' ? 'Buy' : 'Sell';
    } else if (key === 'crypto') {
      const crypto = cryptocurrencies.find(c => c.symbol === value);
      return crypto ? crypto.name : value;
    } else if (key === 'fiat') {
      const fiat = fiatCurrencies.find(f => f.code === value);
      return fiat ? fiat.name : value;
    } else if (key === 'payment') {
      const payment = paymentMethods.find(p => p.id === value);
      return payment ? payment.name : value;
    }
    return value;
  };

  // Active filters for summary (only show non-default filters)
  const activeFilters = [
    ...(tradeType !== 'buy' ? [{ key: 'tradeType', label: getFilterLabel('tradeType', tradeType), value: tradeType }] : []),
    ...(selectedCrypto !== 'BTC' ? [{ key: 'crypto', label: getFilterLabel('crypto', selectedCrypto), value: selectedCrypto }] : []),
    ...(selectedFiat !== 'USD' ? [{ key: 'fiat', label: getFilterLabel('fiat', selectedFiat), value: selectedFiat }] : []),
    ...(selectedPaymentMethod !== 'all' ? [{ key: 'payment', label: getFilterLabel('payment', selectedPaymentMethod), value: selectedPaymentMethod }] : []),
  ];

  // Calculate crypto amount from fiat
  const calculateCryptoAmount = (fiatAmount) => {
    if (!fiatAmount || !selectedOffer) return '0.00000000';
    const cryptoAmount = parseFloat(fiatAmount) / selectedOffer.price;
    return cryptoAmount.toFixed(8);
  };

  // Remove filter
  const removeFilter = (filterKey) => {
    if (filterKey === 'tradeType') {
      setTradeType('buy');
    } else if (filterKey === 'crypto') {
      setSelectedCrypto('BTC');
    } else if (filterKey === 'fiat') {
      setSelectedFiat('USD');
    } else if (filterKey === 'payment') {
      setSelectedPaymentMethod('all');
    }
  };

  // Send chat message
  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const message = {
      id: Date.now(),
      text: newMessage,
      sender: 'me',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    };
    setChatMessages([...chatMessages, message]);
    setNewMessage('');

    // Simulate seller response after 2 seconds
    setTimeout(() => {
      const response = {
        id: Date.now() + 1,
        text: 'Thank you for your message. I will check and confirm shortly.',
        sender: 'seller',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now() + 2000,
      };
      setChatMessages(prev => [...prev, response]);
    }, 2000);
  };

  // Send quick message
  const sendQuickMessage = (text) => {
    const message = {
      id: Date.now(),
      text: text,
      sender: 'me',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    };
    setChatMessages([...chatMessages, message]);

    // Simulate seller response
    setTimeout(() => {
      const response = {
        id: Date.now() + 1,
        text: 'Noted. I will process this accordingly.',
        sender: 'seller',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now() + 2000,
      };
      setChatMessages(prev => [...prev, response]);
    }, 2000);
  };

  // Handle trade initiation
  const handleTradeInitiate = (offer) => {
    setSelectedOffer(offer);
    setActiveTrade(null);
  };

  // Handle active trade view
  const handleViewActiveTrade = (trade) => {
    setActiveTrade(trade);
    setSelectedOffer(null);
  };

  // Timer countdown
  useEffect(() => {
    if (activeTrade) {
      setTimer(activeTrade.timer);
      const interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTrade]);

  // Initialize chat messages when trade starts
  useEffect(() => {
    if (activeTrade) {
      setChatMessages([
        {
          id: 1,
          text: `Order created. Please make payment within ${Math.floor(activeTrade.timer / 60)} minutes.`,
          sender: 'system',
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
        },
      ]);
    }
  }, [activeTrade]);

  return (
    <div className="p2p-trading-page">
      {/* Header Section */}
      <div className="p2p-header">
        <div className="p2p-header-left">
          <button
            className="back-button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="p2p-title">P2P Trading</h1>
            <p className="p2p-subtitle">Trade crypto directly with other users</p>
          </div>
        </div>
        <button
          className="close-button"
          onClick={() => navigate(-1)}
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p2p-container">
        {/* Filter Bar */}
        {!selectedOffer && !activeTrade && (
          <>
            <div className="p2p-filters">
              <div className="filter-row">
                {/* Buy/Sell Toggle */}
                <div className="filter-group toggle-group">
                  <button
                    className={`toggle-btn ${tradeType === 'buy' ? 'active' : ''}`}
                    onClick={() => setTradeType('buy')}
                  >
                    Buy
                  </button>
                  <button
                    className={`toggle-btn ${tradeType === 'sell' ? 'active' : ''}`}
                    onClick={() => setTradeType('sell')}
                  >
                    Sell
                  </button>
                </div>

                {/* Cryptocurrency Dropdown */}
                <div className="filter-group crypto-dropdown">
                  <button
                    className="filter-dropdown-trigger"
                    onClick={() => {
                      setShowCryptoDropdown(!showCryptoDropdown);
                      setShowFiatDropdown(false);
                      setShowPaymentDropdown(false);
                    }}
                  >
                    <span className="crypto-icon">{selectedCryptoData?.icon}</span>
                    <span>{selectedCrypto}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showCryptoDropdown && (
                    <div className="filter-dropdown-menu">
                      {cryptocurrencies.map((crypto) => (
                        <button
                          key={crypto.symbol}
                          className={`filter-dropdown-item ${selectedCrypto === crypto.symbol ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedCrypto(crypto.symbol);
                            setShowCryptoDropdown(false);
                          }}
                        >
                          <span className="crypto-icon">{crypto.icon}</span>
                          <span>{crypto.symbol}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fiat Currency Dropdown */}
                <div className="filter-group fiat-dropdown">
                  <button
                    className="filter-dropdown-trigger"
                    onClick={() => {
                      setShowFiatDropdown(!showFiatDropdown);
                      setShowCryptoDropdown(false);
                      setShowPaymentDropdown(false);
                    }}
                  >
                    <span className="currency-flag">{selectedFiatData?.flag}</span>
                    <span>{selectedFiat}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showFiatDropdown && (
                    <div className="filter-dropdown-menu">
                      {fiatCurrencies.map((fiat) => (
                        <button
                          key={fiat.code}
                          className={`filter-dropdown-item ${selectedFiat === fiat.code ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedFiat(fiat.code);
                            setShowFiatDropdown(false);
                          }}
                        >
                          <span className="currency-flag">{fiat.flag}</span>
                          <span>{fiat.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Method Filter */}
                <div className="filter-group payment-dropdown">
                  <button
                    className="filter-dropdown-trigger"
                    onClick={() => {
                      setShowPaymentDropdown(!showPaymentDropdown);
                      setShowCryptoDropdown(false);
                      setShowFiatDropdown(false);
                    }}
                  >
                    <span>{selectedPaymentData?.icon}</span>
                    <span>{selectedPaymentData?.name}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {showPaymentDropdown && (
                    <div className="filter-dropdown-menu">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          className={`filter-dropdown-item ${selectedPaymentMethod === method.id ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedPaymentMethod(method.id);
                            setShowPaymentDropdown(false);
                          }}
                        >
                          <span>{method.icon}</span>
                          <span>{method.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Active Filters Summary */}
            {activeFilters.length > 0 && (
              <div className="active-filters-summary">
                <span className="filters-label">Active Filters:</span>
                <div className="filters-tags">
                  {activeFilters.map((filter) => (
                    <button
                      key={filter.key}
                      className="filter-tag"
                      onClick={() => removeFilter(filter.key)}
                    >
                      <span>{filter.label}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                  <button
                    className="clear-all-filters"
                    onClick={() => {
                      setTradeType('buy');
                      setSelectedCrypto('BTC');
                      setSelectedFiat('USD');
                      setSelectedPaymentMethod('all');
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Offers List View */}
        {!selectedOffer && !activeTrade && (
          <div className="p2p-offers-section">
            <div className="offers-header">
              <h2 className="section-title">Available Offers</h2>
              <span className="offers-count">{filteredOffers.length} offers</span>
            </div>

            {/* Desktop Table View */}
            <div className="offers-table-desktop">
              <div className="table-header">
                <div className="col-advertiser">Advertiser</div>
                <div className="col-price">Price</div>
                <div className="col-available">Available</div>
                <div className="col-limits">Limits</div>
                <div className="col-payment">Payment</div>
                <div className="col-action">Action</div>
              </div>
              <div className="table-body">
                {filteredOffers.map((offer) => (
                  <div key={offer.id} className="table-row">
                    <div className="col-advertiser">
                      <div className="advertiser-info">
                        <div className="advertiser-main">
                          <span className="username">{offer.advertiser}</span>
                          {offer.online && <span className="online-badge">Online</span>}
                        </div>
                        <div className="advertiser-stats">
                          <span className="completion-rate">{offer.completionRate}% ({offer.trades} trades)</span>
                          <div className="rating">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={i < Math.floor(offer.rating) ? 'star filled' : 'star'}>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width={15}
                                  height={14}
                                  viewBox="0 0 15 14"
                                  fill="none"
                                >
                                  <path
                                    d="M6.88025 0.756345C7.0766 0.325208 7.17482 0.10964 7.31155 0.0432565C7.43029 -0.0144188 7.56973 -0.0144188 7.68847 0.0432565C7.8252 0.10964 7.92342 0.325208 8.11977 0.756345L9.68379 4.19041C9.74189 4.31786 9.7709 4.38159 9.81585 4.43039C9.85555 4.47357 9.90415 4.50811 9.95835 4.53175C10.0197 4.55848 10.0906 4.56581 10.2324 4.58045L14.0528 4.97509C14.5324 5.02463 14.7722 5.0494 14.879 5.15614C14.9717 5.24885 15.0148 5.37868 14.9955 5.50705C14.9732 5.65481 14.7941 5.81277 14.4358 6.12879L11.582 8.64582C11.4761 8.73921 11.4231 8.78594 11.3896 8.8428C11.3599 8.89319 11.3414 8.94906 11.3352 9.00683C11.3281 9.07216 11.3429 9.14039 11.3725 9.27695L12.1696 12.9549C12.2697 13.4167 12.3197 13.6475 12.249 13.7798C12.1875 13.8949 12.0747 13.9751 11.944 13.9967C11.7935 14.0216 11.5846 13.9038 11.1668 13.6679L7.83902 11.7894C7.71553 11.7197 7.65378 11.6849 7.58813 11.6712C7.53003 11.6592 7.46998 11.6592 7.41188 11.6712C7.34623 11.6849 7.28449 11.7197 7.16099 11.7894L3.83322 13.6679C3.41542 13.9038 3.20653 14.0216 3.05605 13.9967C2.92534 13.9751 2.8125 13.8949 2.75106 13.7798C2.68033 13.6475 2.73037 13.4167 2.83044 12.9549L3.62752 9.27695C3.6571 9.14039 3.67189 9.07216 3.66487 9.00683C3.65865 8.94906 3.6401 8.89319 3.61042 8.8428C3.57687 8.78594 3.52391 8.73921 3.418 8.64582L0.564232 6.12879C0.205956 5.81277 0.026814 5.65481 0.00454106 5.50705C-0.0147972 5.37868 0.0282984 5.24885 0.121037 5.15614C0.227805 5.0494 0.467625 5.02463 0.947265 4.97509L4.76767 4.58045C4.90947 4.56581 4.98036 4.55848 5.04166 4.53175C5.0959 4.50811 5.14447 4.47357 5.18422 4.43039C5.22913 4.38159 5.25815 4.31786 5.31621 4.19041L6.88025 0.756345Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </span>
                            ))}
                            <span className="rating-value">{offer.rating}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-price">
                      <span className="price-value">${offer.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="col-available">
                      <span className="available-value">{offer.available} {selectedCrypto}</span>
                    </div>
                    <div className="col-limits">
                      <span className="limits-value">${offer.minAmount}-${offer.maxAmount.toLocaleString()}</span>
                    </div>
                    <div className="col-payment">
                      <div className="payment-methods">
                        {offer.paymentMethods.map((method) => {
                          const methodData = paymentMethods.find(m => m.id === method);
                          return methodData ? (
                            <span key={method} className="payment-badge">{methodData.icon} {methodData.name}</span>
                          ) : null;
                        })}
                      </div>
                      <span className="payment-window">{offer.paymentWindow} min</span>
                    </div>
                    <div className="col-action">
                      <button
                        className={`trade-btn ${tradeType === 'buy' ? 'buy-btn' : 'sell-btn'}`}
                        onClick={() => handleTradeInitiate(offer)}
                      >
                        {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedCrypto}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="offers-cards-mobile">
              {filteredOffers.map((offer) => (
                <div key={offer.id} className="offer-card">
                  <div className="card-header">
                    <div className="advertiser-info">
                      <div className="advertiser-main">
                        <span className="username">{offer.advertiser}</span>
                        {offer.online && <span className="online-badge">Online</span>}
                      </div>
                      <div className="advertiser-stats">
                        <span className="completion-rate">{offer.completionRate}% ({offer.trades} trades)</span>
                        <div className="rating">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < Math.floor(offer.rating) ? 'star filled' : 'star'}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width={15}
                                height={14}
                                viewBox="0 0 15 14"
                                fill="none"
                              >
                                <path
                                  d="M6.88025 0.756345C7.0766 0.325208 7.17482 0.10964 7.31155 0.0432565C7.43029 -0.0144188 7.56973 -0.0144188 7.68847 0.0432565C7.8252 0.10964 7.92342 0.325208 8.11977 0.756345L9.68379 4.19041C9.74189 4.31786 9.7709 4.38159 9.81585 4.43039C9.85555 4.47357 9.90415 4.50811 9.95835 4.53175C10.0197 4.55848 10.0906 4.56581 10.2324 4.58045L14.0528 4.97509C14.5324 5.02463 14.7722 5.0494 14.879 5.15614C14.9717 5.24885 15.0148 5.37868 14.9955 5.50705C14.9732 5.65481 14.7941 5.81277 14.4358 6.12879L11.582 8.64582C11.4761 8.73921 11.4231 8.78594 11.3896 8.8428C11.3599 8.89319 11.3414 8.94906 11.3352 9.00683C11.3281 9.07216 11.3429 9.14039 11.3725 9.27695L12.1696 12.9549C12.2697 13.4167 12.3197 13.6475 12.249 13.7798C12.1875 13.8949 12.0747 13.9751 11.944 13.9967C11.7935 14.0216 11.5846 13.9038 11.1668 13.6679L7.83902 11.7894C7.71553 11.7197 7.65378 11.6849 7.58813 11.6712C7.53003 11.6592 7.46998 11.6592 7.41188 11.6712C7.34623 11.6849 7.28449 11.7197 7.16099 11.7894L3.83322 13.6679C3.41542 13.9038 3.20653 14.0216 3.05605 13.9967C2.92534 13.9751 2.8125 13.8949 2.75106 13.7798C2.68033 13.6475 2.73037 13.4167 2.83044 12.9549L3.62752 9.27695C3.6571 9.14039 3.67189 9.07216 3.66487 9.00683C3.65865 8.94906 3.6401 8.89319 3.61042 8.8428C3.57687 8.78594 3.52391 8.73921 3.418 8.64582L0.564232 6.12879C0.205956 5.81277 0.026814 5.65481 0.00454106 5.50705C-0.0147972 5.37868 0.0282984 5.24885 0.121037 5.15614C0.227805 5.0494 0.467625 5.02463 0.947265 4.97509L4.76767 4.58045C4.90947 4.56581 4.98036 4.55848 5.04166 4.53175C5.0959 4.50811 5.14447 4.47357 5.18422 4.43039C5.22913 4.38159 5.25815 4.31786 5.31621 4.19041L6.88025 0.756345Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </span>
                          ))}
                          <span className="rating-value">{offer.rating}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="card-row">
                      <span className="card-label">Price:</span>
                      <span className="card-value">${offer.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Available:</span>
                      <span className="card-value">{offer.available} {selectedCrypto}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Limits:</span>
                      <span className="card-value">${offer.minAmount}-${offer.maxAmount.toLocaleString()}</span>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Payment:</span>
                      <div className="payment-methods">
                        {offer.paymentMethods.map((method) => {
                          const methodData = paymentMethods.find(m => m.id === method);
                          return methodData ? (
                            <span key={method} className="payment-badge">{methodData.icon} {methodData.name}</span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div className="card-row">
                      <span className="card-label">Payment Window:</span>
                      <span className="card-value">{offer.paymentWindow} minutes</span>
                    </div>
                  </div>
                  <div className="card-footer">
                    <button
                      className={`trade-btn ${tradeType === 'buy' ? 'buy-btn' : 'sell-btn'}`}
                      onClick={() => handleTradeInitiate(offer)}
                    >
                      {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedCrypto}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade Initiation Screen */}
        {selectedOffer && !activeTrade && (
          <div className="p2p-trade-initiation">
            <div className="trade-header-section">
              <button className="back-to-offers" onClick={() => setSelectedOffer(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Offers
              </button>
              <div className="trade-header-info">
                <h3 className="trade-with">Trade with {selectedOffer.advertiser}</h3>
                <div className="trade-header-details">
                  <span>Rate: ${selectedOffer.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {selectedCrypto}</span>
                  <span>Payment Method: {paymentMethods.find(m => m.id === selectedOffer.paymentMethods[0])?.name}</span>
                </div>
              </div>
            </div>

            <div className="trade-form-section">
              <div className="form-group">
                <label className="form-label">I want to pay</label>
                <div className="amount-input-group">
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={selectedOffer.minAmount}
                    max={selectedOffer.maxAmount}
                  />
                  <span className="currency-display">{selectedFiat}</span>
                </div>
                <p className="form-helper">
                  Min: {selectedFiat} {selectedOffer.minAmount} | Max: {selectedFiat} {selectedOffer.maxAmount.toLocaleString()}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">I will receive</label>
                <div className="amount-display">
                  <span className="crypto-amount">{calculateCryptoAmount(amount)}</span>
                  <span className="crypto-symbol">{selectedCrypto}</span>
                </div>
              </div>

              <div className="price-info">
                <div className="price-row">
                  <span>Rate:</span>
                  <span>${selectedOffer.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{selectedCrypto}</span>
                </div>
                <div className="price-row">
                  <span>Fee:</span>
                  <span>0.5% (Included)</span>
                </div>
              </div>
            </div>

            <div className="payment-instructions-section">
              <h4 className="section-subtitle">Payment Details</h4>
              <div className="payment-method-display">
                <span className="payment-method-label">Payment Method:</span>
                <span className="payment-method-value">{paymentMethods.find(m => m.id === selectedOffer.paymentMethods[0])?.name}</span>
              </div>
              <div className="payment-instructions-box">
                <pre className="instructions-text">
                  {`Please transfer to:
Bank: Chase Bank
Account: XXXX-XXXX-1234
Name: John Doe
Reference: P2P-ORDER-123456`}
                </pre>
              </div>
            </div>

            <div className="terms-section">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>I agree to the terms and trade within {selectedOffer.paymentWindow} minutes</span>
              </label>
              <a href="#" className="terms-link">View full terms and conditions</a>
            </div>

            <div className="trade-actions">
              <button className="btn-primary buy-action-btn" onClick={() => {
                const newTrade = {
                  id: 'P2P-ORDER-123456',
                  status: 'waiting_payment',
                  timer: selectedOffer.paymentWindow * 60,
                  advertiser: selectedOffer.advertiser,
                  rate: selectedOffer.price,
                  paymentMethod: selectedOffer.paymentMethods[0],
                  amount: parseFloat(calculateCryptoAmount(amount)),
                  price: parseFloat(amount),
                  orderTime: new Date().toLocaleString(),
                  paymentInstructions: {
                    bank: 'Chase Bank',
                    account: 'XXXX-XXXX-1234',
                    name: 'John Doe',
                    reference: 'P2P-ORDER-123456',
                  },
                };
                setActiveTrade(newTrade);
                setSelectedOffer(null);
              }}>
                {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedCrypto} Now
              </button>
              <button className="btn-secondary" onClick={() => setSelectedOffer(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Active Trade Screen */}
        {activeTrade && (
          <div className="p2p-active-trade">
            <div className="active-trade-header">
              <button className="back-to-offers" onClick={() => {
                setActiveTrade(null);
                setSelectedOffer(null);
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Offers
              </button>
              <div className="trade-status-header">
                <div className="order-id">Order ID: {activeTrade.id}</div>
                <div className="trade-status">
                  <span className={`status-badge status-${activeTrade.status}`}>
                    {activeTrade.status === 'waiting_payment' ? 'Waiting for Payment' :
                      activeTrade.status === 'payment_sent' ? 'Payment Sent' : 'Completed'}
                  </span>
                </div>
                <div className="trade-timer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {formatTimer(timer)} remaining
                </div>
              </div>
            </div>

            {/* Steps Indicator */}
            <div className="steps-indicator">
              <div className={`step ${activeTrade.status === 'waiting_payment' || activeTrade.status === 'payment_sent' || activeTrade.status === 'completed' ? 'completed' : ''}`}>
                <div className="step-number">1</div>
                <div className="step-label">Order Created</div>
              </div>
              <div className="step-connector"></div>
              <div className={`step ${activeTrade.status === 'payment_sent' || activeTrade.status === 'completed' ? 'completed' : activeTrade.status === 'waiting_payment' ? 'current' : ''}`}>
                <div className="step-number">2</div>
                <div className="step-label">Make Payment</div>
              </div>
              <div className="step-connector"></div>
              <div className={`step ${activeTrade.status === 'completed' ? 'completed' : ''}`}>
                <div className="step-number">3</div>
                <div className="step-label">Seller Confirms</div>
              </div>
              <div className="step-connector"></div>
              <div className={`step ${activeTrade.status === 'completed' ? 'completed' : ''}`}>
                <div className="step-number">4</div>
                <div className="step-label">Crypto Released</div>
              </div>
            </div>

            {/* Trade Details Card */}
            <div className="trade-details-card">
              <h4 className="card-title">Trade Details</h4>
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Amount:</span>
                  <span className="detail-value">{activeTrade.amount} {selectedCrypto}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Price:</span>
                  <span className="detail-value">${activeTrade.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Rate:</span>
                  <span className="detail-value">${activeTrade.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{selectedCrypto}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Order Time:</span>
                  <span className="detail-value">{activeTrade.orderTime}</span>
                </div>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="payment-instructions-card">
              <h4 className="card-title">Payment Instructions</h4>
              <div className="payment-amount-display">
                Transfer ${activeTrade.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to:
              </div>
              <div className="payment-instructions-box">
                <div className="instruction-item">
                  <span className="instruction-label">Bank:</span>
                  <span className="instruction-value">{activeTrade.paymentInstructions.bank}</span>
                </div>
                <div className="instruction-item">
                  <span className="instruction-label">Account:</span>
                  <span className="instruction-value">{activeTrade.paymentInstructions.account}</span>
                </div>
                <div className="instruction-item">
                  <span className="instruction-label">Name:</span>
                  <span className="instruction-value">{activeTrade.paymentInstructions.name}</span>
                </div>
                <div className="instruction-item highlight">
                  <span className="instruction-label">Reference:</span>
                  <span className="instruction-value">{activeTrade.paymentInstructions.reference}</span>
                </div>
              </div>
              <div className="payment-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p><strong>Important:</strong></p>
                  <ul>
                    <li>Transfer the exact amount</li>
                    <li>Include the reference code</li>
                    <li>Do NOT mention crypto in transfer notes</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Chat Section */}
            <div className="chat-section">
              <div className="chat-header">
                <h4 className="card-title">Chat with {activeTrade.advertiser}</h4>
                <div className="chat-status">
                  <span className="status-dot online"></span>
                  <span>Online</span>
                </div>
              </div>
              <div className="chat-messages">
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-message ${message.sender === 'me' ? 'message-sent' : message.sender === 'system' ? 'message-system' : 'message-received'}`}
                    >
                      {message.sender !== 'system' && (
                        <div className="message-avatar">
                          {message.sender === 'me' ? 'You' : activeTrade.advertiser.charAt(0)}
                        </div>
                      )}
                      <div className="message-wrapper">
                        {message.sender !== 'system' && (
                          <div className="message-sender-name">
                            {message.sender === 'me' ? 'You' : activeTrade.advertiser}
                          </div>
                        )}
                        <div className="message-content">
                          <p>{message.text}</p>
                        </div>
                        <div className="message-time">{message.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="chat-input-area">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      sendMessage();
                    }
                  }}
                />
                <button className="chat-send-btn" onClick={sendMessage} disabled={!newMessage.trim()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <div className="quick-messages">
                <button className="quick-msg-btn" onClick={() => sendQuickMessage('Payment sent')}>
                  Payment sent
                </button>
                <button className="quick-msg-btn" onClick={() => sendQuickMessage('Need help')}>
                  Need help
                </button>
                <button className="quick-msg-btn" onClick={() => sendQuickMessage('Upload proof')}>
                  Upload proof
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="trade-action-buttons">
              <button className="btn-primary" onClick={() => {
                setActiveTrade({ ...activeTrade, status: 'payment_sent' });
              }}>
                I have paid
              </button>
              <button className="btn-secondary">
                Upload Payment Proof
              </button>
              <button className="btn-danger">
                Cancel Order
              </button>
              <a href="#" className="support-link">Contact Support</a>
            </div>
          </div>
        )}

        {/* Trade History */}
        <div className="p2p-trade-history">
          <button
            className="section-toggle"
            onClick={() => setShowTradeHistory(!showTradeHistory)}
          >
            <h3 className="section-title">My P2P Trades</h3>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={showTradeHistory ? 'rotated' : ''}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {showTradeHistory && (
            <>
              <div className="history-filters">
                <select className="filter-select">
                  <option>All</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                  <option>Disputed</option>
                </select>
                <select className="filter-select">
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>All time</option>
                </select>
              </div>
              <div className="history-table">
                <div className="table-header">
                  <div className="col-order-id">Order ID</div>
                  <div className="col-date">Date/Time</div>
                  <div className="col-type">Type</div>
                  <div className="col-amount">Amount</div>
                  <div className="col-fiat">Fiat</div>
                  <div className="col-counterparty">Counterparty</div>
                  <div className="col-status">Status</div>
                </div>
                <div className="table-body">
                  {tradeHistory.map((trade) => (
                    <div key={trade.id} className="table-row clickable" onClick={() => handleViewActiveTrade({
                      id: trade.id,
                      status: 'completed',
                      timer: 0,
                      advertiser: trade.counterparty,
                      rate: 42850,
                      paymentMethod: 'bank',
                      amount: parseFloat(trade.amount),
                      price: parseFloat(trade.fiat.replace(/[$,]/g, '')),
                      orderTime: `${trade.date} ${trade.time}`,
                      paymentInstructions: {
                        bank: 'Chase Bank',
                        account: 'XXXX-XXXX-1234',
                        name: 'John Doe',
                        reference: trade.id,
                      },
                    })}>
                      <div className="col-order-id">{trade.id}</div>
                      <div className="col-date">{trade.date} {trade.time}</div>
                      <div className="col-type">
                        <span className={`type-badge ${trade.type.toLowerCase()}`}>{trade.type}</span>
                      </div>
                      <div className="col-amount">{trade.amount}</div>
                      <div className="col-fiat">{trade.fiat}</div>
                      <div className="col-counterparty">{trade.counterparty}</div>
                      <div className="col-status">
                        <span className={`status-badge status-${trade.status.toLowerCase()}`}>
                          {trade.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="rating-modal-overlay" onClick={() => setShowRatingModal(false)}>
          <div className="rating-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rate your experience with CryptoTrader123</h3>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} className="star-btn">⭐</button>
              ))}
            </div>
            <textarea
              className="rating-comment"
              placeholder="Optional feedback..."
              rows="4"
            />
            <div className="rating-tags">
              <button className="tag-btn">Fast</button>
              <button className="tag-btn">Friendly</button>
              <button className="tag-btn">Professional</button>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowRatingModal(false)}>
                Submit
              </button>
              <button className="btn-secondary" onClick={() => setShowRatingModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default P2PTrading;

