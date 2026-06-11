import { useEffect, useRef, useState } from "react";
import { useUser } from "../contexts/UserContext";
// import { useUser } from "../../contexts/UserContext";

export const useLetsPay = ({ paymentData, amount }) => {
    const { user } = useUser();
    const scriptsLoadedRef = useRef(false);
    const letspayInitializedRef = useRef(false);
    const [error, setError] = useState(null);
    const [initError, setInitError] = useState(null);

    useEffect(() => {
        if (scriptsLoadedRef.current) return;

        const jqueryScript = document.createElement('script');
        jqueryScript.src = "https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js";
        jqueryScript.async = true;
        jqueryScript.onload = () => {
            const letspayScript = document.createElement('script');
            letspayScript.src = 'https://user.letspay.money/assets/scripts/letspay.js';
            letspayScript.type = 'text/javascript';
            letspayScript.async = true;
            letspayScript.onload = () => {
                scriptsLoadedRef.current = true;
                setTimeout(() => {
                    if (window.letspay && paymentData) {
                        initializeLetspay();
                    }
                }, 100);
            };
            letspayScript.onerror = () => {
                setInitError('Failed to load payment script. Please refresh the page.');
            };
            document.body.appendChild(letspayScript);
        };
        jqueryScript.onerror = () => {
            setInitError('Failed to load required scripts. Please refresh the page.');
        };
        document.body.appendChild(jqueryScript);

        return () => {
            const jquery = document.querySelector('script[src*="jquery.min.js"]');
            const letspay = document.querySelector('script[src*="letspay.js"]');
            if (jquery && jquery.parentNode) jquery.parentNode.removeChild(jquery);
            if (letspay && letspay.parentNode) letspay.parentNode.removeChild(letspay);
        };
    }, []);

    useEffect(() => {
        if (scriptsLoadedRef.current && window.letspay && paymentData && !letspayInitializedRef.current) {
            letspayInitializedRef.current = false;
            initializeLetspay();
        }
    }, [paymentData, amount, user]);

    const initializeLetspay = () => {
        if (!window.letspay) {
            setInitError('Payment system not ready. Please refresh the page.');
            return;
        }

        if (!paymentData) {
            setInitError('Payment data is missing. Please try again.');
            return;
        }

        const userEmail = user?.email;
        const paymentAmount = parseFloat(amount) || parseFloat(paymentData?.amount);
        const invoiceNo = paymentData?.invoiceid || paymentData?.paymentId;
        const merchantId = paymentData?.merchantid;
        const currency = paymentData?.currency || 'USD';

        const missingFields = [];
        if (!userEmail) missingFields.push('email');
        if (!paymentAmount || paymentAmount <= 0) missingFields.push('amount');
        if (!invoiceNo) missingFields.push('invoice number');
        if (!merchantId) missingFields.push('merchant ID');

        if (missingFields.length > 0) {
            setInitError(`Missing required payment information: ${missingFields.join(', ')}. Please try again.`);
            return;
        }

        try {
            const buttonContainer = document.getElementById('letspaybutton');
            if (buttonContainer) {
                buttonContainer.innerHTML = '';
            }

            window.letspay.init({
                "name": "Let'sPay",
                "amount": paymentAmount,
                "invoiceno": invoiceNo,
                "currency": currency,
                "email": userEmail,
                "merchantid": merchantId,
            });

            letspayInitializedRef.current = true;
            setInitError(null);
        } catch (error) {
            setInitError(`Payment initialization failed: ${error.message || 'Unknown error'}. Please try again.`);
            letspayInitializedRef.current = false;
        }
    };

    return { initializeLetspay, initError };

};
