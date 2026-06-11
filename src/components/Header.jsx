import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUser } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";
import { useLatestNotification } from "../contexts/LatestNotificationContext";
import { tokenStorage } from "../utils/storage";
import NotificationBell from "./NotificationBell";
import "../styles/components/MobileSidebar.css";
import "../styles/components/Header.css";
import logo from "../../public/assets/img/m5dex-light-logo.png"
import darklogo from "../../public/assets/img/m5dex-dark-logo.png"

const languages = [
  { code: "en", label: "English (India)", flag: "🇮🇳" },
  { code: "az", label: "Azərbaycan", flag: "🇦🇿" },
  { code: "bg", label: "български", flag: "🇧🇬" },
  { code: "cs", label: "čeština", flag: "🇨🇿" },
  { code: "da", label: "Dansk", flag: "🇩🇰" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },

  { code: "el", label: "Ελληνικά", flag: "🇬🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "en", label: "English (UAE)", flag: "🇦🇪" },
  { code: "en", label: "English (Australia)", flag: "🇦🇺" },
  { code: "en", label: "English (Bahrain)", flag: "🇧🇭" },
  { code: "en", label: "English (Japan)", flag: "🇯🇵" },
  { code: "en", label: "English (Kazakhstan)", flag: "🇰🇿" },
  { code: "en", label: "English (Nigeria)", flag: "🇳🇬" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "ar", label: "العربية (البحرين)", flag: "🇧🇭" },

  { code: "en", label: "English (New Zealand)", flag: "🇳🇿" },
  { code: "en", label: "English (Türkiye)", flag: "🇹🇷" },
  { code: "en", label: "English (South Africa)", flag: "🇿🇦" },
  { code: "es", label: "Español (España)", flag: "🇪🇸" },
  { code: "es", label: "Español (Argentina)", flag: "🇦🇷" },
  { code: "es", label: "Español (Latinoamérica)", flag: "🌎" },
  { code: "es", label: "Español (México)", flag: "🇲🇽" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

const marketCategories = [
  {
    id: "crypto",
    label: "Crypto",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        viewBox="0 0 15 23"
        fill="none"
      >
        <path
          d="M11.9255 10.6163C12.5592 9.99429 13.0045 9.19907 13.2084 8.32548C13.4122 7.45189 13.366 6.53679 13.0753 5.6893C12.7845 4.84181 12.2615 4.09768 11.5685 3.54563C10.8755 2.99359 10.0419 2.65692 9.1669 2.57578V0.851852C9.1669 0.625927 9.07911 0.409255 8.92283 0.249502C8.76656 0.0897484 8.55461 0 8.3336 0C8.1126 0 7.90064 0.0897484 7.74437 0.249502C7.5881 0.409255 7.5003 0.625927 7.5003 0.851852V2.55545L5.8337 2.55529V0.851852C5.8337 0.625927 5.74591 0.409255 5.58964 0.249502C5.43336 0.0897484 5.22141 0 5.00041 0C4.7794 0 4.56745 0.0897484 4.41117 0.249502C4.2549 0.409255 4.16711 0.625927 4.16711 0.851852V2.55519L2.5 2.55504H0.833299C0.612294 2.55504 0.400341 2.64478 0.244067 2.80454C0.0877935 2.96429 0 3.18096 0 3.40689C0 3.63281 0.0877935 3.84948 0.244067 4.00924C0.400341 4.16899 0.612294 4.25874 0.833299 4.25874H1.6666V18.7402H0.833299C0.612294 18.7402 0.400341 18.83 0.244067 18.9897C0.0877935 19.1495 0 19.3661 0 19.5921C0 19.818 0.0877935 20.0347 0.244067 20.1944C0.400341 20.3542 0.612294 20.4439 0.833299 20.4439H2.49979L4.16711 20.444V22.1481C4.16711 22.3741 4.2549 22.5907 4.41117 22.7505C4.56745 22.9103 4.7794 23 5.00041 23C5.22141 23 5.43336 22.9103 5.58964 22.7505C5.74591 22.5907 5.8337 22.3741 5.8337 22.1481V20.4441L7.5003 20.4443V22.1481C7.5003 22.3741 7.5881 22.5907 7.74437 22.7505C7.90064 22.9103 8.1126 23 8.3336 23C8.55461 23 8.76656 22.9103 8.92283 22.7505C9.07911 22.5907 9.1669 22.3741 9.1669 22.1481V20.4444L10.0002 20.4444C11.1558 20.4444 12.2758 20.0352 13.1695 19.2864C14.0633 18.5375 14.6757 17.4953 14.9027 16.3369C15.1296 15.1786 14.957 13.9756 14.4142 12.9327C13.8714 11.8898 12.992 11.0712 11.9255 10.6163ZM11.6668 7.24074C11.6659 8.03121 11.3584 8.78904 10.8116 9.34799C10.2648 9.90693 9.5235 10.2213 8.75025 10.2222H3.3332V4.25884L4.99481 4.25895C4.99669 4.259 4.99852 4.25926 5.00041 4.25926C5.00229 4.25926 5.00412 4.259 5.006 4.25895L8.33299 4.25921L8.3336 4.25926L8.33421 4.25921L8.75025 4.25926C9.5235 4.26015 10.2648 4.57455 10.8116 5.13349C11.3584 5.69244 11.6659 6.45027 11.6668 7.24074ZM10.0003 18.7407L3.3332 18.7403V11.9259H10.0002C10.8842 11.9259 11.732 12.2849 12.3571 12.9239C12.9822 13.5629 13.3334 14.4296 13.3334 15.3333C13.3335 16.237 12.9823 17.1037 12.3572 17.7427C11.7321 18.3817 10.8843 18.7407 10.0003 18.7407Z"
          fill="currentColor"
        />
      </svg>
    ),
    description: "Trade Bitcoin, Ethereum, and 100+ cryptocurrencies",
    path: "/markets/crypto",
    count: "100+",
  },
  {
    id: "forex",
    label: "Forex",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        viewBox="0 0 23 23"
        fill="none"
      >
        <path
          d="M5.26184 1.55953H3.89535V0.582176C3.89535 0.260763 3.6356 0 3.31318 0C2.99176 0 2.731 0.260763 2.731 0.582176V1.55953H1.36552C1.00268 1.55751 0.654983 1.70104 0.398256 1.95777C0.141531 2.21449 -0.00199721 2.56318 2.09998e-05 2.92503V11.5001C2.09998e-05 11.8619 0.144553 12.2086 0.402292 12.4633C0.659016 12.718 1.00468 12.8626 1.36552 12.8656H2.731V13.8359C2.731 14.1573 2.99176 14.4181 3.31318 14.4181C3.6356 14.4181 3.89535 14.1573 3.89535 13.8359V12.8656H5.26184C6.0138 12.8616 6.62328 12.2531 6.62731 11.5001V2.92506C6.62933 2.56323 6.48581 2.21452 6.22908 1.95779C5.97235 1.70107 5.62369 1.55752 5.26184 1.55953ZM5.4559 11.5C5.4559 11.6071 5.36897 11.6941 5.26184 11.6941H1.36539C1.25826 11.6941 1.17133 11.6071 1.17133 11.5V2.92493C1.16931 2.87136 1.19054 2.8188 1.22895 2.78141C1.26634 2.74704 1.31486 2.72885 1.36539 2.73087H5.26184C5.36897 2.73087 5.4559 2.81779 5.4559 2.92493V11.5Z"
          fill="currentColor"
        />
        <path
          d="M13.4475 4.67968H12.082V3.70132C12.082 3.3799 11.8212 3.11914 11.4998 3.11914C11.1784 3.11914 10.9176 3.3799 10.9176 3.70132V4.67968H9.55215C8.79814 4.67968 8.18668 5.29017 8.18668 6.04516V15.3882C8.18668 16.1422 8.79817 16.7537 9.55215 16.7537H10.9176V17.731C10.9176 18.0524 11.1784 18.3132 11.4998 18.3132C11.8212 18.3132 12.082 18.0524 12.082 17.731V16.7607H13.4475C13.8093 16.7607 14.157 16.6172 14.4127 16.3615C14.6694 16.1048 14.813 15.7581 14.813 15.3952V6.0522C14.815 5.68835 14.6725 5.33964 14.4157 5.0819C14.159 4.82417 13.8113 4.67968 13.4475 4.67968ZM13.6557 15.3953C13.6557 15.5025 13.5687 15.5894 13.4616 15.5894H9.55223C9.44509 15.5894 9.35817 15.5025 9.35817 15.3953V6.05232C9.35817 5.94519 9.44509 5.85827 9.55223 5.85827H13.4476C13.5548 5.85827 13.6417 5.94519 13.6417 6.05232L13.6557 15.3953Z"
          fill="currentColor"
        />
        <path
          d="M22.5977 8.9772C22.3409 8.7225 21.9953 8.57796 21.6344 8.57493H20.269V7.60464C20.269 7.28322 20.0082 7.02246 19.6868 7.02246C19.3644 7.02246 19.1046 7.28322 19.1046 7.60464V8.57493H17.7381C16.9862 8.57897 16.3767 9.18743 16.3726 9.9404V20.0749C16.3706 20.4368 16.5141 20.7855 16.7709 21.0422C17.0276 21.2989 17.3763 21.4424 17.7381 21.4404H19.1036V22.4178H19.1046C19.1046 22.7392 19.3644 23 19.6868 23C20.0082 23 20.269 22.7392 20.269 22.4178V21.4404H21.6345C22.3864 21.4364 22.9959 20.8269 22.9999 20.075V9.94043C22.9999 9.5786 22.8554 9.2309 22.5977 8.9772ZM21.8285 20.075C21.8285 20.1822 21.7416 20.2691 21.6344 20.2691H17.738C17.6309 20.2691 17.5439 20.1822 17.5439 20.075V9.94051C17.5419 9.88896 17.5631 9.83843 17.6015 9.80406C17.6379 9.76667 17.6864 9.74544 17.738 9.74645H21.6344C21.7416 9.74645 21.8285 9.83337 21.8285 9.94051V20.075Z"
          fill="currentColor"
        />
      </svg>
    ),
    description: "Trade major currency pairs with tight spreads",
    path: "/markets/forex",
    count: "50+",
  },
  {
    id: "indian",
    label: "Indian Market",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        viewBox="0 0 25 25"
        fill="none"
      >
        <path
          d="M2.03751 17.8501H22.1625M2.03751 6.3501H22.1625M0.600006 12.1001H23.6M0.600006 12.1001C0.600006 18.4514 5.74873 23.6001 12.1 23.6001M0.600006 12.1001C0.600006 5.74882 5.74873 0.600098 12.1 0.600098M23.6 12.1001C23.6 18.4514 18.4513 23.6001 12.1 23.6001M23.6 12.1001C23.6 5.74882 18.4513 0.600098 12.1 0.600098M12.1 23.6001C12.1 23.6001 5.63126 20.7251 5.63126 12.1001C5.63126 3.4751 12.1 0.600098 12.1 0.600098M12.1 23.6001C12.1 23.6001 18.5688 20.7251 18.5688 12.1001C18.5688 3.4751 12.1 0.600098 12.1 0.600098M12.1 23.6001V0.600098"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    ),
    description: "Trade Indian stocks and indices",
    path: "/markets/indian",
    // path: "/dashboard",
    count: "30+",
  },
  // {
  //   id: "commodities",
  //   label: "Commodities",
  //   icon: (
  //     <svg
  //       xmlns="http://www.w3.org/2000/svg"
  //       width={24}
  //       height={24}
  //       viewBox="0 0 16 23"
  //       fill="none"
  //     >
  //       <path
  //         d="M7.51255 0C3.87047 0 0 1.22439 0 3.49384V19.5665C0 19.5901 0.0046718 19.6124 0.00700773 19.6354C0.152195 21.8216 3.94091 23 7.51255 23C11.0844 23 14.8729 21.8216 15.0181 19.6352C15.0206 19.6122 15.0251 19.5899 15.0251 19.5664V3.49384C15.0251 1.22439 11.1548 0 7.51255 0ZM13.6381 14.2706C13.6381 15.1291 11.2517 16.3774 7.51255 16.3774C3.77362 16.3774 1.38701 15.1293 1.38701 14.2706V10.874C2.83834 11.7995 5.22028 12.2849 7.51255 12.2849C9.80501 12.2849 12.1869 11.7995 13.6381 10.874V14.2706ZM13.6381 8.79031C13.6381 9.64976 11.2517 10.8979 7.51255 10.8979C3.77362 10.8979 1.38701 9.64976 1.38701 8.79031V5.57696C2.83834 6.50217 5.22028 6.98769 7.51255 6.98769C9.80501 6.98769 12.1869 6.50217 13.6381 5.57696V8.79031ZM7.51255 1.38701C11.2517 1.38701 13.6381 2.63512 13.6381 3.49384C13.6381 4.35257 11.2517 5.60068 7.51255 5.60068C3.77362 5.60068 1.38701 4.35257 1.38701 3.49384C1.38701 2.63512 3.77362 1.38701 7.51255 1.38701ZM7.51255 21.613C3.77362 21.613 1.38701 20.3649 1.38701 19.5054V16.3535C2.83834 17.2787 5.22028 17.7644 7.51255 17.7644C9.80501 17.7644 12.1869 17.2789 13.6381 16.3535V19.5056C13.6381 20.3649 11.2517 21.613 7.51255 21.613Z"
  //         fill="currentColor"
  //       />
  //     </svg>
  //   ),
  //   description: "Trade gold, silver, oil, and other commodities",
  //   path: "/markets/commodities",
  //   count: "20+",
  // },
  // {
  //   id: "indices",
  //   label: "Indices",
  //   icon: (
  //     <svg
  //       xmlns="http://www.w3.org/2000/svg"
  //       width={24}
  //       height={24}
  //       viewBox="0 0 23 24"
  //       fill="none"
  //     >
  //       <path
  //         d="M16.1653 0.165748C15.9801 0.350996 15.9606 0.623993 16.1263 0.828741C16.2433 0.974989 16.2921 0.974989 17.2671 1.01399L18.2908 1.04324L17.4133 1.94023C15.1416 4.27045 12.5871 6.16193 9.81815 7.56592C6.82493 9.0869 4.08521 9.85714 1.16025 9.99364C0.370504 10.0326 0.282755 10.0424 0.146256 10.1789C-0.0487418 10.3739 -0.0389919 10.6664 0.156006 10.8614C0.282755 10.9979 0.360754 11.0174 0.760499 11.0174C1.96949 11.0174 3.75372 10.7736 5.1577 10.4129C9.58415 9.31115 14.1081 6.62993 17.8716 2.90547L18.8856 1.90123V2.79822C18.8856 3.66596 18.8953 3.70496 19.0416 3.85121C19.2073 4.01696 19.4803 4.05596 19.646 3.92921C19.8703 3.75371 19.8898 3.60746 19.8898 1.97923V0.370496L19.7045 0.185248L19.5193 0H17.9106H16.3116L16.1653 0.165748Z"
  //         fill="currentColor"
  //       />
  //       <path
  //         d="M18.1641 6.17162L18.0081 6.31787V14.5175V22.7172L18.1641 22.8634L18.3103 23.0194H20.504H22.6978L22.844 22.8634L23 22.7172V14.5175V6.31787L22.844 6.17162L22.6978 6.01562H20.504H18.3103L18.1641 6.17162ZM22.0055 14.5175V22.025H20.504H19.0123V14.5175V7.01011H20.5138H22.0153V14.5175H22.0055Z"
  //         fill="currentColor"
  //       />
  //       <path
  //         d="M12.1581 10.1692L12.0021 10.3154V16.5164V22.7173L12.1581 22.8635L12.3044 23.0195H14.4981H16.6918L16.8381 22.8635L16.9941 22.7173V16.5164V10.3154L16.8381 10.1692L16.6918 10.0132H14.4981H12.3044L12.1581 10.1692ZM16.0093 16.5164V22.0153H14.5078H13.0063V16.5164V11.0174H14.5078H16.0093V16.5164Z"
  //         fill="currentColor"
  //       />
  //       <path
  //         d="M6.16192 13.1721L6.00592 13.3184V18.0178V22.7173L6.16192 22.8635L6.30817 23.0195H8.50189H10.6956L10.8419 22.8635L10.9979 22.7173V18.0178V13.3184L10.8419 13.1721L10.6956 13.0161H8.50189H6.30817L6.16192 13.1721ZM10.0034 18.0178V22.0153H8.50189H7.00041V18.0178V14.0204H8.50189H10.0034V18.0178Z"
  //         fill="currentColor"
  //       />
  //       <path
  //         d="M0.155998 15.1709L0 15.3172V19.0221V22.7173L0.155998 22.8636L0.302247 23.0196H2.49597H4.6897L4.83595 22.8636L4.99195 22.7173V19.0221V15.3269L4.83595 15.1807L4.6897 15.0247H2.50572H0.302247L0.155998 15.1709ZM3.99746 19.0221V22.0251H2.50572H1.00424V19.0221V16.0191H2.50572H3.99746V19.0221Z"
  //         fill="currentColor"
  //       />
  //     </svg>
  //   ),
  //   description: "Trade global stock market indices",
  //   path: "/markets/indices",
  //   count: "15+",
  // },
];

const navigationItems = [
  { id: "markets", label: "Markets", path: "/markets", hasDropdown: false },
];

const moreMenuItems = [
  { id: "api", label: "API", path: "/api" },
  { id: "referral", label: "Referral", path: "/referral" },
  { id: "help", label: "Help Center", path: "/help" },
  { id: "fees", label: "Trading Fees", path: "/fees" },
];

const depositOptions = [
  {
    id: "fiat",
    label: "Deposit Fiat",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 19 23"
        fill="none"
      >
        <path
          d="M4.47893 12.8033C4.59327 11.1887 4.82834 9.58491 4.9424 7.97111L1.70783 5.89467C-0.102097 5.2985 -0.204195 3.20258 1.49641 2.87542L2.65648 2.65203L2.60195 2.44589C2.08562 0.495471 4.31173 -0.583645 5.52522 1.02905L5.65291 1.19847L6.54758 0.423697C7.91324 -0.759186 9.42773 0.731658 8.78259 2.47343L8.28101 6.16285C10.6715 7.90156 17.0978 11.1773 18.1113 13.2649C19.5317 16.1912 17.5599 20.2921 14.1501 20.2921H9.62886C8.72974 21.9682 7.01105 23 5.11822 23C2.29149 23 0 20.7085 0 17.8818C0 15.3021 1.92371 13.1219 4.47893 12.8033ZM7.38189 17.3187C8.12272 17.3187 8.12272 18.4451 7.38189 18.4451H5.68156V20.1457C5.68156 20.8866 4.55488 20.8866 4.55488 20.1457V18.4451H2.85427C2.11344 18.4451 2.11344 17.3187 2.85427 17.3187H4.55488V15.6181C4.55488 14.8773 5.68156 14.8773 5.68156 15.6181V17.3187H7.38189ZM10.072 19.1656H14.1501C16.7364 19.1656 18.1536 15.9255 17.0992 13.7534C16.2975 12.102 9.74876 8.61374 7.64394 7.08701L6.06631 8.01006C5.95586 9.60606 5.72496 11.192 5.60701 12.7875C6.25297 12.8504 6.88531 13.0348 7.46228 13.3325C8.1191 13.6713 7.60416 14.6703 6.94735 14.3317C6.37538 14.0363 5.76113 13.8905 5.11822 13.8905C2.91381 13.8905 1.12669 15.6774 1.12669 17.8818C1.12669 20.0862 2.91381 21.8733 5.11822 21.8733C7.76301 21.8733 9.65056 19.3582 8.97316 16.8402C8.78232 16.1253 9.86922 15.8348 10.0603 16.5498C10.2907 17.4063 10.2974 18.3071 10.072 19.1656ZM7.15961 6.06993L7.67343 2.29205C7.68484 2.11094 7.95663 0.689372 7.1891 1.35398L5.98702 2.39498C5.72218 2.62449 5.35441 2.66928 5.11738 2.35325L4.62748 1.70228C4.15428 1.07328 3.48717 1.39738 3.68913 2.15991L3.89249 2.928C3.98819 3.24681 3.78789 3.58009 3.45962 3.64268L1.70756 3.97985C0.762809 4.16152 2.15295 4.8442 2.25087 4.90708L5.53885 7.01829L7.15961 6.06993ZM7.85454 9.96437C7.47286 9.3312 8.4368 8.75033 8.8182 9.38322L8.97121 9.63721C9.83806 9.54624 10.8059 9.92654 11.2658 10.6899C11.6474 11.3231 10.6835 11.9039 10.3021 11.2708C10.0364 10.8298 9.35873 10.6596 8.88386 10.7934C7.63059 11.2499 8.97483 12.3126 9.91012 12.0238C11.9256 11.4018 14.0282 13.7264 12.2489 15.079L12.2728 15.1115C12.6553 15.6312 11.7059 16.239 11.3609 15.745L11.1792 15.4846C10.3127 15.5755 9.34455 15.195 8.88469 14.4319C8.50329 13.7987 9.46695 13.2179 9.84863 13.851C10.1508 14.3526 11.0107 14.5234 11.5019 14.2277C12.2951 13.7503 11.1698 12.8109 10.2403 13.0977C8.19894 13.7278 6.14003 11.382 7.90183 10.0425L7.85454 9.96437Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    id: "pay-through-deposit",
    label: "Crypto",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 28 21"
        fill="none"
      >
        <path
          d="M2.89396 4.36152H5.26464L5.44322 2.62969C5.52581 1.82657 5.92427 1.13088 6.49908 0.658057C7.07499 0.184101 7.82838 -0.0670226 8.61862 0.0155366L25.4053 1.78921C26.1977 1.87292 26.8841 2.27675 27.3507 2.8593C27.8183 3.44298 28.0661 4.20651 27.9847 5.0074L26.8819 15.7242C26.7993 16.5273 26.4009 17.223 25.8261 17.6958C25.2501 18.1698 24.4979 18.4209 23.7065 18.3383L22.6629 18.2275C22.6228 18.9707 22.3069 19.6437 21.8169 20.1392C21.2935 20.6697 20.5691 21 19.7722 21H2.89525C2.09832 21 1.37508 20.6697 0.850504 20.1392C0.325932 19.6075 0 18.8745 0 18.0669V7.29132C0 6.48365 0.325904 5.75066 0.850504 5.21902C1.37396 4.68738 2.09835 4.35819 2.89525 4.35819L2.89396 4.36152ZM6.58045 4.36152H19.7698C20.5667 4.36152 21.2899 4.69182 21.8145 5.22236C22.3391 5.75287 22.665 6.48701 22.665 7.29465V16.896L23.837 17.0204C24.2711 17.0668 24.683 16.9288 24.9988 16.6697C25.3147 16.4096 25.5335 16.0295 25.5781 15.5928L26.6809 4.87607C26.7266 4.43606 26.5904 4.01866 26.3349 3.69853C26.0782 3.3784 25.7031 3.15782 25.2723 3.11146L8.48564 1.33666C8.05148 1.29141 7.63962 1.42828 7.32375 1.68731C7.00787 1.94748 6.78912 2.32754 6.74449 2.7642L6.58042 4.36027L6.58045 4.36152ZM14.6969 13.5861H17.6256C18.1859 13.5861 18.6949 13.818 19.0643 14.1924C19.4327 14.5657 19.6615 15.0815 19.6615 15.6505C19.6615 16.2183 19.4327 16.7342 19.0643 17.1086C18.696 17.4819 18.1871 17.7149 17.6256 17.7149H14.6969C14.1366 17.7149 13.6276 17.483 13.2582 17.1086C12.8899 16.7353 12.6611 16.2195 12.6611 15.6505C12.6611 15.0827 12.8899 14.5668 13.2582 14.1924C13.6265 13.8191 14.1355 13.5861 14.6969 13.5861ZM17.6256 14.9164H14.6969C14.4993 14.9164 14.3174 14.9989 14.1857 15.1313C14.054 15.2648 13.9725 15.448 13.9725 15.6494C13.9725 15.8496 14.054 16.034 14.1857 16.1675C14.3174 16.3009 14.4982 16.3824 14.6969 16.3824H17.6256C17.8232 16.3824 18.0051 16.2998 18.1368 16.1675C18.2685 16.034 18.35 15.8507 18.35 15.6494C18.35 15.4492 18.2685 15.2648 18.1368 15.1313C18.0051 14.9978 17.8243 14.9164 17.6256 14.9164ZM21.3524 12.0997H1.31102V18.07C1.31102 18.51 1.4896 18.9104 1.77644 19.2023C2.06329 19.493 2.45839 19.674 2.8937 19.674H19.7706C20.2048 19.674 20.5999 19.493 20.8879 19.2023C21.1747 18.9116 21.3533 18.5112 21.3533 18.07V12.0997H21.3524ZM1.31102 10.7695H21.3524V9.1881H1.31102V10.7695ZM1.31102 7.85774H21.3524V7.29442C21.3524 6.8544 21.1738 6.45397 20.887 6.1621C20.6001 5.87139 20.205 5.6904 19.7697 5.6904H2.89279C2.45862 5.6904 2.06351 5.87139 1.77553 6.1621C1.48868 6.45281 1.3101 6.85324 1.3101 7.29442V7.85774H1.31102Z"
          fill="currentColor"
        />
      </svg>
    )
  },
];

const profileMenuItems = [
  {
    id: "profile",
    label: "Profile",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M15.5112 13.0896C16.8201 12.2805 17.8295 11.0666 18.3862 9.63196C18.9429 8.19734 19.0166 6.6203 18.596 5.14004C18.1755 3.65977 17.2836 2.35705 16.0558 1.42945C14.8279 0.501857 13.331 0 11.7922 0C10.2533 0 8.75647 0.501857 7.52862 1.42945C6.30076 2.35705 5.40892 3.65977 4.98835 5.14004C4.56778 6.6203 4.64144 8.19734 5.19814 9.63196C5.75485 11.0666 6.76424 12.2805 8.0732 13.0896C6.07444 13.7424 4.28048 14.9052 2.86841 16.4632C1.45635 18.0212 0.475008 19.9205 0.0212636 21.9736C-0.00359451 22.0819 -0.00669162 22.194 0.0121522 22.3035C0.030996 22.413 0.0714052 22.5177 0.131033 22.6114C0.190661 22.7052 0.26832 22.7861 0.359499 22.8496C0.450678 22.9131 0.55356 22.9578 0.662172 22.9812C0.770784 23.0046 0.88296 23.0062 0.992186 22.9858C1.10141 22.9655 1.20551 22.9237 1.29844 22.8628C1.39137 22.8019 1.47127 22.7232 1.53351 22.6311C1.59576 22.5391 1.63909 22.4356 1.66101 22.3267C2.16376 20.0135 3.44297 17.942 5.28603 16.4565C7.12908 14.971 9.425 14.1609 11.7922 14.1609C14.1594 14.1609 16.4553 14.971 18.2984 16.4565C20.1414 17.942 21.4206 20.0135 21.9234 22.3267C21.9636 22.5142 22.0669 22.6822 22.216 22.8028C22.3652 22.9233 22.5511 22.9892 22.7428 22.9893C22.8026 22.989 22.8622 22.9825 22.9206 22.97C23.1379 22.923 23.3276 22.7916 23.4481 22.6048C23.5686 22.4179 23.6099 22.1909 23.5631 21.9736C23.1092 19.9205 22.1278 18.0213 20.7158 16.4634C19.3037 14.9054 17.5099 13.7426 15.5112 13.0896ZM6.39739 7.08002C6.39739 6.01294 6.7138 4.96981 7.3066 4.08254C7.89941 3.19527 8.742 2.5037 9.72782 2.09526C10.7136 1.68683 11.7984 1.57988 12.8451 1.78794C13.8917 1.99599 14.8531 2.50971 15.6077 3.26414C16.3624 4.01856 16.8764 4.97982 17.0848 6.02636C17.2932 7.0729 17.1866 8.15773 16.7784 9.14368C16.3703 10.1296 15.679 10.9724 14.7919 11.5655C13.9048 12.1586 12.8618 12.4753 11.7947 12.4757C10.3639 12.4745 8.99195 11.9058 7.98005 10.8942C6.96814 9.8826 6.39895 8.51085 6.39739 7.08002Z"
          fill="currentColor"
        />
        <path
          d="M0.922913 22.35L22.7835 22.35"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    path: "/profile",
  },
  {
    id: "security",
    label: "Security",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 19 21"
        fill="none"
      >
        <path
          d="M17.7775 9.43275C17.7775 14.119 14.3755 18.5082 9.72754 19.7923C9.41129 19.8786 9.06629 19.8786 8.75004 19.7923C4.10209 18.5082 0.700012 14.119 0.700012 9.43275V5.22564C0.700012 4.43981 1.29419 3.54857 2.0321 3.25148L7.37004 1.06651C8.56796 0.577764 9.91921 0.577764 11.1171 1.06651L16.455 3.25148C17.1834 3.54857 17.7871 4.43981 17.7871 5.22564L17.7775 9.43275Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.23881 10.7553C10.2974 10.7553 11.1555 9.89724 11.1555 8.83866C11.1555 7.78012 10.2974 6.922 9.23881 6.922C8.18024 6.922 7.32214 7.78012 7.32214 8.83866C7.32214 9.89724 8.18024 10.7553 9.23881 10.7553Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.2388 10.7552V13.6302"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeMiterlimit={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    path: "/profile/security",
  },
  // {
  //   id: "referrals",
  //   label: "Referrals",
  //   icon: (
  //     <svg
  //       xmlns="http://www.w3.org/2000/svg"
  //       width={18}
  //       height={18}
  //       viewBox="0 0 25 25"
  //       fill="none"
  //     >
  //       <path
  //         d="M12.25 7.13889V23.75M12.25 7.13889H6.5C5.65278 7.13889 4.84026 6.80233 4.24118 6.20326C3.64211 5.60419 3.30556 4.79166 3.30556 3.94444C3.30556 3.09723 3.64211 2.2847 4.24118 1.68563C4.84026 1.08655 5.65278 0.75 6.5 0.75C10.9722 0.75 12.25 7.13889 12.25 7.13889ZM12.25 7.13889H18C18.8472 7.13889 19.6597 6.80233 20.2589 6.20326C20.8579 5.60419 21.1944 4.79166 21.1944 3.94444C21.1944 3.09723 20.8579 2.2847 20.2589 1.68563C19.6597 1.08655 18.8472 0.75 18 0.75C13.5278 0.75 12.25 7.13889 12.25 7.13889ZM0.75 14.8056H23.75M4.83889 23.75H19.6611C21.0923 23.75 21.808 23.75 22.3547 23.4714C22.8355 23.2265 23.2265 22.8355 23.4714 22.3547C23.75 21.808 23.75 21.0923 23.75 19.6611V11.2278C23.75 9.79654 23.75 9.08091 23.4714 8.53425C23.2265 8.05338 22.8355 7.66243 22.3547 7.41743C21.808 7.13889 21.0923 7.13889 19.6611 7.13889H4.83889C3.40765 7.13889 2.69202 7.13889 2.14536 7.41743C1.66449 7.66243 1.27354 8.05338 1.02854 8.53425C0.75 9.08091 0.75 9.79654 0.75 11.2278V19.6611C0.75 21.0923 0.75 21.808 1.02854 22.3547C1.27354 22.8355 1.66449 23.2265 2.14536 23.4714C2.69202 23.75 3.40764 23.75 4.83889 23.75Z"
  //         stroke="currentColor"
  //         strokeWidth="1.5"
  //         strokeLinecap="round"
  //         strokeLinejoin="round"
  //       />
  //     </svg>
  //   ),
  //   path: "/profile/referral",
  // },
  {
    id: "logout",
    label: "Logout",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={18}
        height={18}
        viewBox="0 0 19 19"
        fill="none"
      >
        <path
          d="M13.2083 13.8001L18 9.00841M18 9.00841L13.2083 4.21676M18 9.00841H6.5M9.375 13.8001C9.375 14.0834 9.375 14.225 9.36446 14.3477C9.25502 15.6228 8.31595 16.6721 7.06065 16.9217C6.9399 16.9456 6.79902 16.9613 6.51758 16.9926L5.53873 17.1013C4.06821 17.2647 3.33291 17.3464 2.74876 17.1595C1.96989 16.9103 1.33403 16.3411 1.0003 15.5946C0.75 15.0346 0.75 14.2949 0.75 12.8152V5.20163C0.75 3.72203 0.75 2.98224 1.0003 2.4223C1.33403 1.67572 1.96989 1.10659 2.74876 0.857355C3.33291 0.670423 4.06819 0.752121 5.53873 0.915507L6.51758 1.02427C6.79911 1.05556 6.93988 1.0712 7.06065 1.0952C8.31595 1.34478 9.25502 2.39405 9.36446 3.66918C9.375 3.79187 9.375 3.9335 9.375 4.21676"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    action: "logout"
  },
];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);
  const profileRef = useRef(null);
  const latestNotif = useLatestNotification();
  const moreMenuRef = useRef(null);
  const marketsRef = useRef(null);
  const langRef = useRef(null);
  const mobileLangRef = useRef(null);
  const timeoutRef = useRef(null);
  const { user } = useUser();
  const { logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [activeMenu, setActiveMenu] = useState(null);
  const [showDepositDropdown, setShowDepositDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMarketsDropdown, setShowMarketsDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLang, setSelectedLang] = useState(
    localStorage.getItem("selectedLanguage") || "en",
  );
  const [selectedLabel, setSelectedLabel] = useState(
    localStorage.getItem("selectedLabel") || "English",
  );
  const userName = user?.full_name || user?.name || user?.username || "User Account";
  const userEmail = user?.email || "user@example.com";
  const userInitials = userName.charAt(0).toUpperCase();
  const hideMenu = tokenStorage.getToken();
  const filteredLanguages = languages.filter((lang) =>
    lang.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const accountFrozen = user?.isfreeze ?? user?.isfreeze ?? false;

  // const changeLanguage = (langCode, label) => {
  //   const googleSelect = document.querySelector(".goog-te-combo");
  //   if (googleSelect) {
  //     googleSelect.value = langCode;
  //     // googleSelect.dispatchEvent(new Event("change"));

  //     setTimeout(() => {
  //       googleSelect.dispatchEvent(new Event("change"));
  //     }, 100); // 100ms is usually enough

  //     // Save both code and label
  //     localStorage.setItem("selectedLanguage", langCode);
  //     localStorage.setItem("selectedLabel", label);

  //     setSelectedLang(langCode);
  //     setSelectedLabel(label);
  //     setShowLangDropdown(false);
  //   }
  // };

  const changeLanguage = (langCode, label) => {
    const googleSelect = document.querySelector(".goog-te-combo");

    if (googleSelect) {
      localStorage.setItem("selectedLanguage", langCode);
      localStorage.setItem("selectedLabel", label);
      setSelectedLang(langCode);
      setSelectedLabel(label);

      googleSelect.value = langCode;

      googleSelect.dispatchEvent(new Event("change", { bubbles: true }));

      setTimeout(() => {
        const selectEl = document.querySelector(".goog-te-combo");
        if (selectEl) {
          selectEl.value = langCode;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, 100);

      if (setShowLangDropdown) setShowLangDropdown(false);
    }
  };
  // const changeLanguage = (langCode, label) => {
  //   const googleSelect = document.querySelector(".goog-te-combo");

  //   if (googleSelect) {
  //     localStorage.setItem("selectedLanguage", langCode);
  //     localStorage.setItem("selectedLabel", label);
  //     setSelectedLang(langCode);
  //     setSelectedLabel(label);
  //     if (setShowLangDropdown) setShowLangDropdown(false);

  //     setTimeout(() => {
  //       const selectEl = document.querySelector(".goog-te-combo");
  //       if (selectEl) {
  //         selectEl.value = langCode;

  //         selectEl.dispatchEvent(new Event("click", { bubbles: true }));
  //         selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  //       }
  //     }, 150);
  //   } else {
  //     console.error("Google Translate not loaded yet");
  //   }
  // };

  useEffect(() => {
    const applySavedLanguage = () => {
      const savedLang = localStorage.getItem("selectedLanguage");
      const googleSelect = document.querySelector(".goog-te-combo");

      if (googleSelect && savedLang && savedLang !== "en") {
        googleSelect.value = savedLang;
        googleSelect.dispatchEvent(new Event("change"));
      }
    };

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        { pageLanguage: "en" },
        "google_translate_element",
      );
      setTimeout(applySavedLanguage, 1000);
    };

    if (!document.querySelector("#google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src =
        "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!showLangDropdown) setSearchTerm("");
  }, [showLangDropdown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!showLangDropdown) return;
      const ref = isMobile ? mobileLangRef.current : langRef.current;
      if (ref && !ref.contains(event.target)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLangDropdown, isMobile]);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1199);
      if (window.innerWidth >= 1199) {
        setShowMobileMenu(false);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Close language dropdown when mobile sidebar closes
  useEffect(() => {
    if (!showMobileMenu && isMobile) {
      setShowLangDropdown(false);
    }
  }, [showMobileMenu, isMobile]);

  useEffect(() => {
    const path = location.pathname;
    const menuItem = navigationItems.find((item) => item.path === path);
    if (menuItem) {
      setActiveMenu(menuItem.id);
    } else {
      setActiveMenu(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isMarketButton = event.target.closest(".market-category-button");
      if (isMarketButton) {
        return;
      }

      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDepositDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
      if (marketsRef.current && !marketsRef.current.contains(event.target)) {
        const isInsideDropdown = event.target.closest(".markets-dropdown");
        if (!isInsideDropdown) {
          setShowMarketsDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      // navigate("/dashboard", { replace: true });
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/login", { replace: true });
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
    setShowMobileMenu(false);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowDepositDropdown(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowDepositDropdown(false);
    }, 200);
  };

  return (
    <>
      {accountFrozen && (
        <div className="account-frozen-bar" role="banner">
          <div className="account-frozen-bar-inner">
            <span className="account-frozen-bar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <span className="account-frozen-bar-text">Your account is frozen. Trading, deposit and withdrawals are disabled.</span>
            <button
              type="button"
              className="account-frozen-bar-btn"
              onClick={() => navigate("/profile/security")}
            >
              Unfreeze account
            </button>
          </div>
        </div>
      )}
      <header className="header">
        <div className="header-container">
          <div className="header-content">
            <div className="header-logo">
              <div className="header-logo-mark">
         <img style={{height:"100px"}} src={!isDark?darklogo:logo} alt="" />
              </div>
              {!isMobile && (
                <h1
                  className="logo-text text-h1 text-primary"
                // onClick={() => navigate("/dashboard")}
                >

                </h1>
              )}
            </div>

            {!isMobile && !!hideMenu && (
              <nav className="header-nav">
                {/* Markets Menu - Always visible */}
                {navigationItems.map((item) => {
                  if (item.id === "markets") {
                    return (
                      <div
                        key={item.id}
                        style={{
                          position: "relative",
                          zIndex: 10001,
                        }}
                        ref={marketsRef}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <button
                            className="header-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMarketsDropdown(!showMarketsDropdown);
                            }}
                            onMouseEnter={() => {
                              if (!isMobile) {
                                setShowMarketsDropdown(true);
                              }
                            }}
                            style={{
                              // padding: "var(--space-xs) var(--space-sm)",
                              // padding: "12px 20px",
                              // color:
                              //   activeMenu === item.id || showMarketsDropdown
                              //     ? "var(--brand-primary)"
                              //     : "var(--text-secondary)",
                              // background: "none",
                              // border: "none",
                              cursor: "pointer",
                              fontFamily: "var(--font-primary)",
                              fontSize: "14px",
                              // fontWeight:
                              //   activeMenu === item.id || showMarketsDropdown
                              //     ? 600
                              //     : 400,
                              position: "relative",
                              transition: "color 0.2s",
                              whiteSpace: "nowrap",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            onMouseLeave={(e) => {
                              if (
                                activeMenu !== item.id &&
                                !showMarketsDropdown
                              ) {
                                e.currentTarget.style.color =
                                  "var(--text-secondary)";
                              }
                            }}
                          >
                            {item.label}
                            <svg
                              style={{
                                width: "14px",
                                height: "14px",
                                transform: showMarketsDropdown
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                                transition: "transform 0.2s",
                              }}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                            {(activeMenu === item.id ||
                              showMarketsDropdown) && (
                                <div
                                  style={{
                                    position: "absolute",
                                    bottom: "-1px",
                                    left: "var(--space-sm)",
                                    right: "var(--space-sm)",
                                    height: "2px",
                                    // backgroundColor: "var(--brand-primary)",
                                    borderRadius: "var(--radius-sm)",
                                  }}
                                ></div>
                              )}
                          </button>
                        </div>

                        {showMarketsDropdown &&
                          marketsRef.current &&
                          createPortal(
                            <div
                              className="markets-dropdown"
                              onMouseEnter={() => setShowMarketsDropdown(true)}
                              onMouseLeave={() => setShowMarketsDropdown(false)}
                              style={{
                                position: "fixed",
                                top: marketsRef.current
                                  ? `${marketsRef.current.getBoundingClientRect().bottom + 4}px`
                                  : "64px",
                                left: isMobile
                                  ? "16px"
                                  : marketsRef.current
                                    ? `${Math.max(16, marketsRef.current.getBoundingClientRect().left)}px`
                                    : "16px",
                                right: isMobile ? "16px" : "auto",
                                marginTop: 0,
                                backgroundColor: "var(--bg-secondary)",
                                border: "1px solid var(--border-light)",
                                borderRadius: "var(--radius-lg)",
                                boxShadow: "var(--shadow-lg)",
                                minWidth: isMobile
                                  ? "calc(100vw - 32px)"
                                  : "600px",
                                maxWidth: isMobile
                                  ? "calc(100vw - 32px)"
                                  : "700px",
                                zIndex: 10001,
                                padding: isMobile
                                  ? "var(--space-md)"
                                  : "var(--space-lg)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "var(--space-md)",
                                overflow: "visible",
                                animation: "slideDownFade 0.3s ease-out",
                              }}
                            >
                              {/* Market Categories Title */}
                              <div
                                style={{
                                  fontFamily: "var(--font-primary)",
                                  fontSize: "12px",
                                  color: "var(--text-tertiary)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  fontWeight: 600,
                                  paddingBottom: "var(--space-xs)",
                                }}
                              >
                                Market Categories
                              </div>

                              {/* Market Categories Grid */}
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: isMobile
                                    ? "1fr"
                                    : "repeat(2, 1fr)",
                                  gap: "var(--space-sm)",
                                  width: "100%",
                                }}
                              >
                                {marketCategories.map((category) => (
                                  <button
                                    key={category.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setShowMarketsDropdown(false);
                                      navigate(category.path);
                                    }}
                                    className="market-category-button"
                                    style={{
                                      width: "100%",
                                      padding: "var(--space-md)",
                                      background: "transparent",
                                      border: "1px solid var(--border-light)",
                                      borderRadius: "var(--radius-md)",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease",
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "var(--space-md)",
                                      textAlign: "left",
                                      position: "relative",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "var(--bg-secondary)";
                                      e.currentTarget.style.borderColor =
                                        "var(--brand-primary)";
                                      e.currentTarget.style.transform =
                                        "translateY(-2px)";
                                      e.currentTarget.style.boxShadow =
                                        "var(--shadow-md)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
                                      e.currentTarget.style.borderColor =
                                        "var(--border-light)";
                                      e.currentTarget.style.transform =
                                        "translateY(0)";
                                      e.currentTarget.style.boxShadow = "none";
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "var(--radius-md)",
                                        // background:
                                        //   "linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
                                        background: "var(--bg-tertiary)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "24px",
                                        flexShrink: 0,
                                        transition: "all 0.2s ease",
                                      }}
                                      className="market-category-icon"
                                    >
                                      {category.icon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontFamily: "var(--font-primary)",
                                          fontSize: "15px",
                                          fontWeight: 600,
                                          color: "var(--text-primary)",
                                          marginBottom: "4px",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          gap: "var(--space-xs)",
                                        }}
                                      >
                                        <span>{category.label}</span>
                                        {/* {category.count && (
                                          <span
                                            style={{
                                              fontSize: "11px",
                                              fontWeight: 500,
                                              padding: "2px 8px",
                                              background: "var(--bg-tertiary)",
                                              color: "var(--text-secondary)",
                                              borderRadius: "12px",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {category.count}
                                          </span>
                                        )} */}
                                      </div>
                                      <div
                                        style={{
                                          fontFamily: "var(--font-primary)",
                                          fontSize: "12px",
                                          color: "var(--text-secondary)",
                                          lineHeight: "1.5",
                                        }}
                                      >
                                        {category.description}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>,
                            document.body,
                          )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveMenu(item.id);
                        navigate(item.path);
                      }}
                      className={`nav-button ${activeMenu === item.id ? "active" : ""}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
                {/* More Menu - Only visible when authenticated */}
                {/* {isAuthenticated && (
                  <div style={{ position: "relative" }} ref={moreMenuRef}>
                    <button
                      className="header-link"
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      style={{
                        cursor: "pointer",
                        fontFamily: "var(--font-primary)",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      More
                      <svg
                        style={{ width: "14px", height: "14px" }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {showMoreMenu && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          marginTop: "var(--space-xs)",
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "var(--radius-lg)",
                          padding: "var(--space-xs)",
                          minWidth: "180px",
                          boxShadow: "var(--shadow-lg)",
                          zIndex: 1001,
                        }}
                      >
                        {moreMenuItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              navigate(item.path);
                              setShowMoreMenu(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "var(--space-sm) var(--space-md)",
                              textAlign: "left",
                              color: "var(--text-primary)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "var(--font-primary)",
                              fontSize: "14px",
                              borderRadius: "var(--radius-md)",
                              transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--bg-tertiary)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )} */}
              </nav>
            )}

            {/* Search Bar - Desktop */}
            {/* {!isMobile && (
              <div className="header-search">
                <input
                  type="text"
                  placeholder="Search trading pairs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <svg
                  className="search-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            )} */}

            {/* Right Section */}
            <div className="header-right">
              {/* Show Login/Register buttons if not authenticated */}
              {!isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate("/login")}
                    className="header-link"
                    style={{
                      padding: isMobile
                        ? "var(--space-xs) var(--space-sm)"
                        : "var(--space-xs) var(--space-md)",
                      borderRadius: "var(--radius-md)",
                      fontWeight: 500,
                      transition: "all 0.2s",
                      margin: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!isMobile) {
                        e.currentTarget.style.color = "var(--text-primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isMobile) {
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }
                    }}
                  >
                    {isMobile ? "Login" : "Log In"}
                  </button>
                  <button
                    onClick={() => navigate("/signup")}
                    className="btn btn-primary"
                    style={{
                      padding: isMobile
                        ? "var(--space-xs) var(--space-sm)"
                        : "var(--space-xs) var(--space-md)",
                      borderRadius: "var(--radius-md)",
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    {isMobile ? "Sign Up" : "Sign Up"}
                  </button>
                </>
              ) : (
                <>
                  {/* Support Chat Icon - Desktop */}
                  {/* {!isMobile && (
                    <button
                      onClick={() => navigate("/support")}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        backgroundColor: "transparent",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        transition: "color 0.2s",
                        flexShrink: 0,
                        margin: 0,
                        padding: 0,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--text-primary)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--text-secondary)")
                      }
                      title="Support Chat"
                    >
                      <svg
                        style={{ width: "18px", height: "18px" }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </button>
                  )} */}

                  {/* Download Icon - Desktop */}
                  {/* {!isMobile && (
                    <button
                      onClick={() => navigate("/download")}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        backgroundColor: "transparent",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        transition: "color 0.2s",
                        flexShrink: 0,
                        margin: 0,
                        padding: 0,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--text-primary)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--text-secondary)")
                      }
                      title="Download App"
                    >
                      <svg
                        style={{ width: "18px", height: "18px" }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </button>
                  )} */}

                  {/* Settings Icon - Desktop */}
                  {/* {!isMobile && (
                    <button
                      onClick={() => navigate("/settings")}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        backgroundColor: "transparent",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        transition: "color 0.2s",
                        flexShrink: 0,
                        margin: 0,
                        padding: 0,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--text-primary)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--text-secondary)")
                      }
                      title="Settings"
                    >
                      <svg
                        style={{ width: "18px", height: "18px" }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </button>
                  )}   */}
                </>
              )}

              {/* Authenticated User Links - Wallet, Orders, Deposit */}
              {isAuthenticated && !isMobile && (
                <>
                  {/* Deposit Dropdown */}
                  <div
                    style={{ position: "relative", margin: 0, padding: 0 }}
                    ref={dropdownRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDepositDropdown(!showDepositDropdown);
                      }}
                      className="header-link"
                      style={{
                        cursor: "pointer",
                        fontFamily: "var(--font-primary)",
                        fontSize: "14px",
                        fontWeight: 400,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        whiteSpace: "nowrap",
                        color: showDepositDropdown ? "var(--brand-primary)" : "inherit",
                        transition: "color 0.2s",
                      }}
                    // onMouseEnter={(e) => {
                    //   e.currentTarget.style.color = "var(--brand-primary)";
                    // }}
                    // onMouseLeave={(e) => {
                    //   e.currentTarget.style.color = "";
                    // }}
                    >
                      Deposit
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        style={{
                          width: "14px",
                          height: "14px",
                          transform: showDepositDropdown
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {showDepositDropdown && (
                      <div
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        // onMouseEnter={() => setShowDepositDropdown(true)}
                        // onMouseLeave={() => setShowDepositDropdown(false)}
                        style={{
                          position: "absolute",
                          top: "100%",
                          right: 0,
                          marginTop: "var(--space-xs)",
                          backgroundColor: "var(--bg-secondary)",
                          border: "1px solid var(--border-light)",
                          borderRadius: "var(--radius-lg)",
                          padding: "var(--space-xs)",
                          minWidth: "180px",
                          boxShadow: "var(--shadow-lg)",
                          zIndex: 1001,
                          paddingTop: "8px",
                        }}
                      >
                        {depositOptions.map((option) => {
                          const isActive =
                            (option.id === "fiat" &&
                              location.pathname === "/deposit-fiat") ||
                            (option.id === "pay-through-deposit" &&
                              location.pathname === "/pay-through-deposit");

                          return (
                            <button
                              key={option.id}
                              onClick={() => {
                                if (option.id === "crypto") {
                                  navigate("/deposit-crypto");
                                } else if (option.id === "fiat") {
                                  navigate("/deposit-fiat");
                                } else if (
                                  option.id === "pay-through-deposit"
                                ) {
                                  navigate("/pay-through-deposit");
                                } else if (option.id === "p2p") {
                                  navigate("/p2p-trading");
                                } else {
                                  navigate(`/deposit/${option.id}`);
                                }
                                setShowDepositDropdown(false);
                              }}
                              className={`dropdown-item ${isActive ? "active" : ""}`}
                            >
                              <span style={{ fontSize: "16px" }}>
                                {option.icon}
                              </span>
                              {option.label}
                              {isActive && (
                                <svg
                                  style={{
                                    width: "14px",
                                    height: "14px",
                                    marginLeft: "auto",
                                  }}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Wallet Link */}
                  <button
                    onClick={() => navigate("/wallet")}
                    className={`header-link ${location.pathname === "/wallet" ? "active" : ""}`}
                    title="Wallet"
                  >
                    Wallet
                  </button>

                  {/* Orders Link */}
                  <button
                    onClick={() => navigate("/orders")}
                    className={`header-link ${location.pathname === "/orders" ? "active" : ""}`}
                    title="Orders"
                  >
                    Orders
                  </button>

                  {/* Notification Bell - Latest notification indicator */}
                  <NotificationBell />
                </>
              )}

              {/* Language Selector - Desktop - Always visible */}
              {!isMobile && (
                <div
                  style={{ position: "relative" }}
                  ref={langRef}
                // onMouseEnter={() => setShowLangDropdown(true)}
                // onMouseLeave={() => setShowLangDropdown(false)}
                >
                  <button
                    onClick={() => setShowLangDropdown(!showLangDropdown)}
                    className="language_icon"
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      transition: "color 0.2s",
                      fontFamily: "var(--font-primary)",
                      fontSize: "12px",
                      fontWeight: 600,
                      flexShrink: 0,
                      margin: 0,
                      padding: 0,
                    }}
                    // onMouseEnter={(e) =>
                    //   (e.currentTarget.style.color = "var(--text-primary)")
                    // }
                    // onMouseLeave={(e) =>
                    //   (e.currentTarget.style.color = "var(--text-secondary)")
                    // }
                    title="Language"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={20}
                      height={20}
                      viewBox="0 0 25 25"
                      fill="none"
                    >
                      <path
                        d="M2.03751 17.8501H22.1625M2.03751 6.3501H22.1625M0.600006 12.1001H23.6M0.600006 12.1001C0.600006 18.4514 5.74873 23.6001 12.1 23.6001M0.600006 12.1001C0.600006 5.74882 5.74873 0.600098 12.1 0.600098M23.6 12.1001C23.6 18.4514 18.4513 23.6001 12.1 23.6001M23.6 12.1001C23.6 5.74882 18.4513 0.600098 12.1 0.600098M12.1 23.6001C12.1 23.6001 5.63126 20.7251 5.63126 12.1001C5.63126 3.4751 12.1 0.600098 12.1 0.600098M12.1 23.6001C12.1 23.6001 18.5688 20.7251 18.5688 12.1001C18.5688 3.4751 12.1 0.600098 12.1 0.600098M12.1 23.6001V0.600098"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </button>
                  {/* Language Dropdown */}
                  {/* {showLangDropdown && (
                    <div
                      className="language-dropdown"
                      style={{
                        right: 0,
                        top: "calc(100% + 10px)",
                        // minWidth: "150px"
                        minWidth: "220px", // Made slightly wider for the search bar
                      }}
                    >
                      <div style={{ padding: "8px", borderBottom: "1px solid var(--border-light)" }}>
                        <input
                          type="text"
                          placeholder="Search language..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          autoFocus
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-light)",
                            backgroundColor: "var(--bg-main)",
                            color: "var(--text-primary)",
                            fontSize: "14px",
                            outline: "none",
                          }}
                        />
                      </div>
                      <div style={{ maxHeight: "200px", overflowY: "auto", marginTop: "5px" }}>
                        {filteredLanguages.length > 0 ? (

                          filteredLanguages.map((lang) => (
                            <button
                              key={lang.label} // Use label as key since codes are duplicates
                              className={`dropdown-item notranslate ${selectedLabel === lang.label ? "active" : ""}`}
                              onClick={() => changeLanguage(lang.code, lang.label)} // Pass both to the function
                              style={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                padding: "10px",
                                // Check against label here too
                                background: selectedLabel === lang.label ? "rgba(240, 185, 11, 0.1)" : "transparent",
                                border: selectedLabel === lang.label ? "1px solid #f0b90b" : "1px solid transparent",
                                borderRadius: "8px",
                                color: selectedLabel === lang.label ? "#f0b90b" : "inherit",
                                marginBottom: "4px"
                              }}
                            >
                              {lang.label}
                            </button>
                          ))


                        ) : (
                          <div style={{ padding: "10px", textAlign: "center", color: "var(--text-secondary)" }}>
                            No languages found
                          </div>
                        )}

                      </div>
                      
                    </div>
                  )} */}
                  {/* Language Dropdown */}
                  {showLangDropdown && (
                    <div
                      className="language-dropdown"
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        minWidth: "220px",
                        backgroundColor: "var(--bg-elevated)",
                        borderRadius: "8px",
                        padding: "10px 0",
                        boxShadow: "var(--shadow-lg)",
                        zIndex: 1000,
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      <div
                        style={{
                          padding: "0 16px 12px",
                          color: "var(--text-tertiary)",
                          fontSize: "14px",
                        }}
                      >
                        Language
                      </div>

                      <div style={{ padding: "0 8px 16px" }}>
                        <input
                          type="text"
                          placeholder="Search"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          autoFocus
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "4px",
                            border: "1px solid var(--border-medium)",
                            backgroundColor: "var(--bg-secondary)",
                            color: "var(--text-primary)",
                            fontSize: "14px",
                            outline: "none",
                          }}
                        />
                      </div>

                      <div
                        className="hide-scrollbar"
                        style={{
                          maxHeight: "280px",
                          overflowY: "auto",
                          marginTop: "8px",
                        }}
                      >
                        {filteredLanguages.length > 0 ? (
                          filteredLanguages.map((lang) => (
                            <button
                              key={lang.label}
                              className={`dropdown-item notranslate ${selectedLabel === lang.label ? "active" : ""}`}
                              onClick={() => {
                                changeLanguage(lang.code, lang.label);
                                setShowLangDropdown(false);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                padding: "10px 16px",
                                background: "transparent",
                                border: "none",
                                color:
                                  selectedLabel === lang.label
                                    ? "var(--text-link)"
                                    : "var(--text-primary)",
                                fontSize: "14px",
                                fontWeight:
                                  selectedLabel === lang.label ? "600" : "400",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "color 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "var(--text-link)";
                              }}
                              onMouseLeave={(e) => {
                                if (selectedLabel !== lang.label) {
                                  e.currentTarget.style.color =
                                    "var(--text-primary)";
                                } else {
                                  e.currentTarget.style.color = "var(--text-link)";
                                }
                              }}
                            >
                              {lang.label}
                            </button>
                          ))
                        ) : (
                          <div
                            style={{
                              padding: "10px 16px",
                              color: "var(--text-tertiary)",
                              fontSize: "13px",
                            }}
                          >
                            No language found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* {!isMobile && (
                <button
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    // backgroundColor: "#1F232D",
                    // border: "1px solid #2D3748",
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    transition: "color 0.2s",
                    fontFamily: "var(--font-primary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    flexShrink: 0,
                    margin: 0,
                    padding: 0,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--text-primary)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--text-secondary)")
                  }
                  title="Language"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={27}
                    height={27}
                    viewBox="0 0 27 27"
                    fill="none"
                  >
                    <path
                      d="M13.4091 2.90796C11.3324 2.90796 9.30228 3.52378 7.57555 4.67754C5.84882 5.8313 4.503 7.4712 3.70827 9.38983C2.91355 11.3085 2.70561 13.4197 3.11076 15.4565C3.51591 17.4933 4.51594 19.3643 5.9844 20.8327C7.45287 22.3012 9.3238 23.3012 11.3606 23.7064C13.3974 24.1115 15.5087 23.9036 17.4273 23.1089C19.3459 22.3141 20.9858 20.9683 22.1396 19.2416C23.2933 17.5148 23.9092 15.4848 23.9092 13.408C23.906 10.6242 22.7987 7.95532 20.8303 5.98685C18.8618 4.01839 16.1929 2.91112 13.4091 2.90796ZM23.0443 12.9807H18.7497C18.7205 11.418 18.4273 9.87144 17.8822 8.40653C18.7905 7.97809 19.6323 7.42125 20.382 6.75311C21.9961 8.43726 22.9424 10.6511 23.0443 12.9816V12.9807ZM13.8361 4.1352C14.4832 4.66936 15.0634 5.27989 15.5638 5.95345C16.0283 6.57741 16.4267 7.24791 16.7526 7.95417C15.8167 8.29956 14.8328 8.4975 13.8361 8.54089V4.1352ZM14.8422 3.86903C16.6692 4.14397 18.3783 4.93972 19.7648 6.16098C19.098 6.7461 18.3534 7.23622 17.5523 7.6174C16.9062 6.20093 15.985 4.92707 14.8422 3.86989V3.86903ZM11.2979 5.95401C11.7872 5.29569 12.3525 4.69744 12.9821 4.17165V8.54146C11.9985 8.49895 11.0272 8.30568 10.1023 7.96841C10.4296 7.25715 10.8303 6.58202 11.2979 5.95401ZM9.30146 7.63533C8.48652 7.25175 7.72948 6.75564 7.0525 6.16155C8.45205 4.92908 10.18 4.13046 12.0255 3.86305C10.8749 4.92624 9.94871 6.20895 9.30146 7.63561V7.63533ZM12.9821 9.3955V12.9824H8.96639C8.99873 11.5393 9.27149 10.1118 9.77345 8.75839C10.8031 9.13742 11.8858 9.35222 12.9821 9.3955ZM12.9821 13.8365V17.3625C11.9114 17.4046 10.8536 17.6106 9.84548 17.9734C9.31104 16.6568 9.01344 15.2561 8.96639 13.8359L12.9821 13.8365ZM12.9821 18.2165V22.5585C11.8355 21.4652 10.8917 20.1774 10.1945 18.7549C11.0919 18.4385 12.0313 18.2569 12.9821 18.216V18.2165ZM12.1679 22.973C10.2553 22.7253 8.46154 21.908 7.01976 20.6272C7.72763 19.9988 8.5244 19.4783 9.3843 19.0825C10.0811 20.5299 11.0228 21.8459 12.1679 22.9724V22.973ZM13.8361 22.5992V18.2151C14.8 18.2566 15.7522 18.4427 16.6607 18.7674C15.9553 20.2028 14.9987 21.5003 13.8361 22.5986V22.5992ZM17.4692 19.0993C18.3155 19.4931 19.1001 20.0078 19.7984 20.6272C18.3694 21.8966 16.5943 22.711 14.7001 22.9664C15.8382 21.8457 16.7749 20.5373 17.4692 19.0988V19.0993ZM13.8361 17.3628V13.8359H17.8948C17.8478 15.261 17.5484 16.6665 17.0106 17.9871C15.9911 17.6157 14.9202 17.4048 13.8361 17.3619V17.3628ZM13.8361 12.9827V9.39578C14.9456 9.35171 16.041 9.13157 17.0814 8.74358C17.587 10.1011 17.8617 11.5337 17.8939 12.9819L13.8361 12.9827ZM6.43617 6.75425C7.19597 7.43163 8.05045 7.99467 8.97265 8.4256C8.43214 9.88529 8.14131 11.4256 8.11235 12.9819H3.77386C3.87613 10.6517 4.82238 8.43825 6.43617 6.75425ZM3.77386 13.8359H8.11235C8.15593 15.3671 8.46973 16.8785 9.03927 18.3005C8.07867 18.7413 7.19029 19.3248 6.40428 20.0314C4.80924 18.3509 3.87508 16.1506 3.77386 13.8359ZM20.4125 20.0317C19.637 19.3341 18.7618 18.7563 17.8156 18.3173C18.3893 16.8904 18.7053 15.3732 18.7491 13.8359H23.0443C22.9427 16.1509 22.008 18.3512 20.4125 20.0317Z"
                      fill="#73757A"
                    />
                  </svg>
                </button>
              )} */}

              {/* Theme Toggle - Desktop - Always visible */}
              {!isMobile && (
                <button
                  onClick={toggleTheme}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    // backgroundColor: "#1F232D",
                    // border: "1px solid #2D3748",
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    transition: "color 0.2s",
                    fontFamily: "var(--font-primary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    flexShrink: 0,
                    margin: 0,
                    padding: 0,
                  }}
                  className="theme_icon"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--text-primary)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--text-secondary)")
                  }
                  title={
                    isDark ? "Switch to Light Theme" : "Switch to Dark Theme"
                  }
                >
                  {isDark ? (
                    <svg
                      style={{ width: "18px", height: "18px" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg
                      style={{ width: "18px", height: "18px" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </button>
              )}

              {/* Mobile Menu Toggle - Always visible on mobile */}
              {isMobile && (
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className={`mobile-menu-toggle ${showMobileMenu ? "active" : ""}`}
                >
                  {showMobileMenu ? (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </button>
              )}

              {/* Profile Icon with Dropdown - Only when authenticated */}
              {isAuthenticated && (
                <div
                  style={{ position: "relative", margin: 0, padding: 0 }}
                  ref={profileRef}
                >
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="profile-button"
                  >
                    {user?.avatar_url ? (
                      <img
                        src={
                          user.avatar_url.startsWith('http')
                            ? user.avatar_url
                            : (import.meta.env.VITE_IMAGE_URL || '') + user.avatar_url
                        }
                        alt={userName}
                        className="header-profile-avatar"
                      />
                    ) : (
                      <span className="header-profile-initials">{userInitials}</span>
                    )}
                  </button>

                  {showProfileDropdown && (
                    <div className="header-dropdown">
                      {profileMenuItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.action === "logout") {
                              handleLogout();
                            } else {
                              navigate(item.path);
                            }
                            setShowProfileDropdown(false);
                          }}
                          className={`dropdown-item ${item.id === "logout" ? "danger" : ""}`}
                          style={{
                            color:
                              item.id === "logout"
                                ? "var(--color-danger)"
                                : undefined,
                          }}
                        >
                          <span style={{ fontSize: "16px" }}>{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div
          className={`mobile-sidebar-overlay ${showMobileMenu ? "active" : ""}`}
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <div className={`mobile-sidebar ${showMobileMenu ? "active" : ""}`}>
          {/* Sidebar Header */}
          <div className="mobile-sidebar-header">
            {isAuthenticated ? (
              <div className="mobile-sidebar-user">
                <div className="mobile-sidebar-avatar">
                  {user?.avatar_url ? (
                    <img
                      src={
                        user.avatar_url.startsWith('http')
                          ? user.avatar_url
                          : (import.meta.env.VITE_IMAGE_URL || '') + user.avatar_url
                      }
                      alt={userName}
                    />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="mobile-sidebar-user-info">
                  <div className="mobile-sidebar-username">{userName}</div>
                  <div className="mobile-sidebar-user-email">{userEmail}</div>
                </div>
                <button
                  className="mobile-sidebar-close"
                  onClick={() => setShowMobileMenu(false)}
                  aria-label="Close menu"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="mobile-sidebar-user">
                <div className="mobile-sidebar-user-info">
                  <div className="mobile-sidebar-username">Welcome to GlobalX</div>
                  <div className="mobile-sidebar-user-email">
                    Sign in to continue
                  </div>
                </div>
                <button
                  className="mobile-sidebar-close"
                  onClick={() => setShowMobileMenu(false)}
                  aria-label="Close menu"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Content – same options as desktop nav */}
          <div className="mobile-sidebar-content">
            {/* Login/Register for unauthenticated */}
            {!isAuthenticated && (
              <div className="mobile-sidebar-auth-buttons">
                <button
                  onClick={() => { navigate("/login"); setShowMobileMenu(false); }}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "var(--space-sm)", marginBottom: "var(--space-sm)" }}
                >
                  Log In
                </button>
                <button
                  onClick={() => { navigate("/signup"); setShowMobileMenu(false); }}
                  className="header-link"
                  style={{
                    width: "100%",
                    padding: "var(--space-md)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* 1. Markets – same as desktop (link + categories) */}
            <div className="mobile-sidebar-section">
              <div className="mobile-sidebar-section-title">Markets</div>
              <div className="mobile-sidebar-nav">
                {/* <button
                  className={`mobile-sidebar-item ${location.pathname === "/markets" ? "active" : ""}`}
                  onClick={() => handleNavigation("/markets")}
                >
                  <div className="mobile-sidebar-item-icon">📊</div>
                  <div className="mobile-sidebar-item-label">Markets</div>
                  <svg className="mobile-sidebar-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button> */}
                {marketCategories.map((category) => (
                  <button
                    key={category.id}
                    className={`mobile-sidebar-item mobile-sidebar-subitem ${location.pathname === category.path ? "active" : ""}`}
                    onClick={() => handleNavigation(category.path)}
                  >
                    <div className="mobile-sidebar-item-icon">{typeof category.icon === "object" ? "•" : category.icon}</div>
                    <div className="mobile-sidebar-item-label">{category.label}</div>
                    {/* <svg className="mobile-sidebar-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg> */}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Deposit, Wallet, Orders, Notifications – same as desktop (authenticated only) */}
            {isAuthenticated && (
              <div className="mobile-sidebar-section">
                <div className="mobile-sidebar-section-title">Account</div>
                <div className="mobile-sidebar-nav">
                  {/* <div className="mobile-sidebar-subsection-label">Deposit</div> */}
                  {depositOptions.map((option) => {
                    const path = option.id === "fiat" ? "/deposit-fiat" : option.id === "pay-through-deposit" ? "/pay-through-deposit" : `/deposit/${option.id}`;
                    return (
                      <button
                        key={option.id}
                        className={`mobile-sidebar-item mobile-sidebar-subitem ${location.pathname === path ? "active" : ""}`}
                        onClick={() => { handleNavigation(path); }}
                      >
                        <div className="mobile-sidebar-item-icon">{option.icon}</div>
                        <div className="mobile-sidebar-item-label">{option.label}</div>
                        {/* <svg className="mobile-sidebar-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg> */}
                      </button>
                    );
                  })}
                  <button
                    className={`mobile-sidebar-item ${location.pathname === "/wallet" ? "active" : ""}`}
                    onClick={() => handleNavigation("/wallet")}
                  >
                    <div className="mobile-sidebar-item-icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div className="mobile-sidebar-item-label">Wallet</div>
                    {/* <svg className="mobile-sidebar-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg> */}
                  </button>
                  <button
                    className={`mobile-sidebar-item ${location.pathname === "/orders" ? "active" : ""}`}
                    onClick={() => handleNavigation("/orders")}
                  >
                    <div className="mobile-sidebar-item-icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="mobile-sidebar-item-label">Orders</div>
                    {/* <svg className="mobile-sidebar-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg> */}
                  </button>
                  <button
                    className={`mobile-sidebar-item mobile-sidebar-quick-action-notifications ${location.pathname === "/profile/notifications" ? "active" : ""}`}
                    onClick={() => handleNavigation("/profile/notifications")}
                  >
                    <div className="mobile-sidebar-item-icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {latestNotif?.hasUnread && <span className="mobile-sidebar-notif-badge" />}
                    </div>
                    <div className="mobile-sidebar-item-label">Notifications</div>
                    {/* <svg className="mobile-sidebar-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg> */}
                  </button>
                </div>
              </div>
            )}

            {/* 3. More – same as desktop (Help Center, API, Referral, Trading Fees) */}
            {/* <div className="mobile-sidebar-section">
              <div className="mobile-sidebar-section-title">More</div>
              <div className="mobile-sidebar-nav">
                {moreMenuItems.map((item) => (
                  <button
                    key={item.id}
                    className={`mobile-sidebar-item ${location.pathname === item.path ? "active" : ""}`}
                    onClick={() => handleNavigation(item.path)}
                  >
                    <div className="mobile-sidebar-item-icon">
                      {item.id === "api" ? "🔌" : item.id === "referral" ? "🎁" : item.id === "help" ? "❓" : "💳"}
                    </div>
                    <div className="mobile-sidebar-item-label">{item.label}</div>
                    <svg className="mobile-sidebar-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div> */}

            {/* 4. Profile & Security – same as desktop profile dropdown (authenticated only, excluding Logout) */}
            {isAuthenticated && (
              <div className="mobile-sidebar-section">
                <div className="mobile-sidebar-section-title">Profile</div>
                <div className="mobile-sidebar-nav">
                  {profileMenuItems.filter((p) => p.id !== "logout").map((item) => (
                    <button
                      key={item.id}
                      className={`mobile-sidebar-item ${location.pathname === item.path ? "active" : ""}`}
                      onClick={() => handleNavigation(item.path)}
                    >
                      <div className="mobile-sidebar-item-icon">{item.icon}</div>
                      <div className="mobile-sidebar-item-label">{item.label}</div>
                      {/* <svg className="mobile-sidebar-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg> */}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer - Theme, Language (same as desktop), Settings and Logout for authenticated */}
          <div className="mobile-sidebar-footer">
            <button
              className="mobile-sidebar-footer-item"
              onClick={toggleTheme}
            >
              <div className="mobile-sidebar-footer-item-icon">
                {isDark ? (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </div>
              <span>{isDark ? "Light Theme" : "Dark Theme"}</span>
            </button>
            {/* Language selector - same as desktop, always visible */}
            <div className="mobile-sidebar-footer-lang-wrap" ref={mobileLangRef}>
              <button
                type="button"
                className="mobile-sidebar-footer-item"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                aria-expanded={showLangDropdown}
                aria-haspopup="listbox"
                title="Language"
              >
                <div className="mobile-sidebar-footer-item-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 25 25" fill="none">
                    <path d="M2.03751 17.8501H22.1625M2.03751 6.3501H22.1625M0.600006 12.1001H23.6M0.600006 12.1001C0.600006 18.4514 5.74873 23.6001 12.1 23.6001M0.600006 12.1001C0.600006 5.74882 5.74873 0.600098 12.1 0.600098M23.6 12.1001C23.6 18.4514 18.4513 23.6001 12.1 23.6001M23.6 12.1001C23.6 5.74882 18.4513 0.600098 12.1 0.600098M12.1 23.6001C12.1 23.6001 5.63126 20.7251 5.63126 12.1001C5.63126 3.4751 12.1 0.600098 12.1 0.600098M12.1 23.6001C12.1 23.6001 18.5688 20.7251 18.5688 12.1001C18.5688 3.4751 12.1 0.600098 12.1 0.600098M12.1 23.6001V0.600098" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </div>
                <span className="notranslate">Language ({selectedLabel})</span>
              </button>
              {showLangDropdown && (
                <div className="mobile-sidebar-lang-dropdown" role="listbox">
                  <div className="mobile-sidebar-lang-dropdown-header">Language</div>
                  <div className="mobile-sidebar-lang-dropdown-search">
                    <input
                      type="text"
                      placeholder="Search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      aria-label="Search language"
                      className="mobile-sidebar-lang-search-input"
                    />
                  </div>
                  <div className="mobile-sidebar-lang-dropdown-list hide-scrollbar">
                    {filteredLanguages.length > 0 ? (
                      filteredLanguages.map((lang) => (
                        <button
                          key={lang.label}
                          type="button"
                          role="option"
                          aria-selected={selectedLabel === lang.label}
                          className={`mobile-sidebar-lang-option notranslate ${selectedLabel === lang.label ? "active" : ""}`}
                          onClick={() => {
                            changeLanguage(lang.code, lang.label);
                            setShowLangDropdown(false);
                          }}
                        >
                          {lang.label}
                        </button>
                      ))
                    ) : (
                      <div className="mobile-sidebar-lang-empty">No language found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {isAuthenticated && (
              <>
                {/* <button
                  className="mobile-sidebar-footer-item"
                  onClick={() => handleNavigation("/settings")}
                >
                  <div className="mobile-sidebar-footer-item-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <span>Settings</span>
                </button> */}
                <button
                  className="mobile-sidebar-footer-item danger"
                  onClick={handleLogout}
                >
                  <div className="mobile-sidebar-footer-item-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </div>
                  <span>Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
