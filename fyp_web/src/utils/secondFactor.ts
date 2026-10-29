import Swal from 'sweetalert2';
import { api } from '../services/api';

export async function verifySecondFactor(challenge: string) {
  const result = await Swal.fire({
    title: 'Verify your sign-in', text: 'Enter your authenticator code or a one-use recovery code.',
    input: 'text', inputAttributes: { autocomplete: 'one-time-code', maxlength: '32', 'aria-label': 'Authenticator or recovery code' },
    showCancelButton: true, confirmButtonText: 'Verify & sign in', confirmButtonColor: '#2563eb',
    showLoaderOnConfirm: true, allowOutsideClick: () => !Swal.isLoading(),
    preConfirm: async code => {
      if (!String(code).trim()) { Swal.showValidationMessage('Enter a verification code.'); return false; }
      try { return (await api.post('/auth/login/verify', { challenge_token: challenge, code }, { timeout: 15000 })).data; }
      catch (failure: unknown) { Swal.showValidationMessage((failure as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Could not verify; check your connection and retry.'); return false; }
    },
  });
  if (!result.isConfirmed) throw new Error('Sign-in cancelled; no session was created.');
  return result.value;
}
