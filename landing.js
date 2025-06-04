import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById('contactForm');
const feedback = document.getElementById('contactFeedback');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const message = document.getElementById('contactMessage').value.trim();

  if (!name || !email || !message) return;
  form.querySelector('button').disabled = true;
  feedback.textContent = 'Sending...';
  feedback.classList.remove('hidden');
  try {
    await addDoc(collection(db, 'contact_messages'), {
      name,
      email,
      message,
      createdAt: new Date().toISOString()
    });
    feedback.textContent = 'Thanks! We will get back to you soon.';
    form.reset();
  } catch (err) {
    console.error('Contact form error:', err);
    feedback.textContent = 'Could not send message.';
  } finally {
    form.querySelector('button').disabled = false;
  }
});
