import React, { useState, useEffect } from 'react';
import AppIcon from '../components/AppIcon';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../services/firebase';
import type { ConfirmationResult } from 'firebase/auth';
import { getUserRoleByPhone } from '../services/firestoreUsers';
import { useNavigate } from 'react-router-dom';

// Extend window type for recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

const Login: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
  if (typeof window !== 'undefined' && !window.recaptchaVerifier) {
    const container = document.getElementById('recaptcha-container');

    if (!container) {
      console.error('reCAPTCHA container not found in DOM.');
      setError('reCAPTCHA failed to load.');
      return;
    }

    try {
      const verifier = new RecaptchaVerifier(auth, container, {
        size: 'invisible',
      });

      window.recaptchaVerifier = verifier;

      verifier.render().then(widgetId => {
        console.log('reCAPTCHA widgetId:', widgetId);
      }).catch(err => {
        console.error('reCAPTCHA failed to render:', err);
        setError('reCAPTCHA failed to render. Disable ad blockers and try again.');
      });
    } catch (err) {
      console.error('Error initializing reCAPTCHA:', err);
      setError('Failed to initialize reCAPTCHA.');
    }
  }

  return () => {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = undefined;
    }
  };
}, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone.replace(/^0+/, '');
    }

    if (!formattedPhone || !/^\+91\d{10}$/.test(formattedPhone)) {
      setError('Please enter a valid 10-digit mobile number.');
      setLoading(false);
      return;
    }

    try {
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) {
        throw new Error('Recaptcha verifier is not initialized.');
      }

      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmation(result);
      setStep('otp');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('Recaptcha')) {
        setError('reCAPTCHA is not ready. Please refresh and try again.');
      } else {
        setError('Failed to send OTP. Please check the phone number.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (confirmation) {
        await confirmation.confirm(otp);

        let formattedPhone = phone.trim();
        if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+91' + formattedPhone.replace(/^0+/, '');
        }

        if (!formattedPhone || !/^\+91\d{10}$/.test(formattedPhone)) {
          setError('Please enter a valid 10-digit mobile number.');
          setLoading(false);
          return;
        }

        const userDoc = await getUserRoleByPhone(formattedPhone);
        if (!userDoc) {
          navigate('/profile');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-200 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 md:p-10 flex flex-col items-center pb-24">
        <div className="w-16 h-16 mb-4 rounded-full bg-blue-100 flex items-center justify-center shadow-lg">
          <AppIcon className="w-10 h-10 text-blue-600" />
        </div>
        
        <h2 className="text-3xl font-extrabold text-blue-700 mb-2 text-center">Welcome Back</h2>
        <p className="text-gray-500 mb-6 text-center">Sign in with your mobile number</p>
        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="w-full flex flex-col gap-4">
            <div className="flex w-full">
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-100 text-gray-600 text-lg select-none">+91</span>
              <input
                type="tel"
                placeholder="Enter mobile number"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-4 py-3 border border-gray-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg bg-gray-50"
                required
                maxLength={10}
              />
            </div>
            
            {error && <div className="text-red-500 text-sm text-center">{error}</div>}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-blue-800 transition-all text-lg disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="w-full flex flex-col gap-4">
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg bg-gray-50"
              required
            />
            {error && <div className="text-red-500 text-sm text-center">{error}</div>}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-blue-800 transition-all text-lg disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}
        <div className="mt-6 text-gray-400 text-xs text-center">
          &copy; {new Date().getFullYear()} Apartment Activity Management
        </div>
      </div>
    </div>
  );
};

export default Login;
