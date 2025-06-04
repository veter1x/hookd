// admin.js
import { firebaseConfig } from './firebase-config.js'; // Make sure this path is correct
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  writeBatch, // Ensure writeBatch is imported
  // FieldValue // Uncomment if you use FieldValue.delete() for specific field deletions
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- DOM Elements ---
const adminLoginContainer = document.getElementById('admin-login-container');
const adminPanelContainer = document.getElementById('admin-panel-container');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminUsernameInput = document.getElementById('adminUsername');
const adminPasswordInput = document.getElementById('adminPassword');
const adminLoginError = document.getElementById('adminLoginError');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

const adminMenuButtons = document.querySelectorAll('.admin-menu button[data-tab]');
const adminTabSections = document.querySelectorAll('.admin-main-content .admin-tab-section');

const usersTableContainer = document.getElementById('usersTableContainer');
const publicCampaignsTableContainer = document.getElementById('publicCampaignsTableContainer');
const submissionsTableContainer = document.getElementById('submissionsTableContainer');
const userCampaignsTableContainer = document.getElementById('userCampaignsTableContainer');

// Stats Card Elements
const totalUsersCardValue = document.getElementById('totalUsersCardValue');
const totalPublicCampaignsCardValue = document.getElementById('totalPublicCampaignsCardValue');
const totalSubmissionsCardValue = document.getElementById('totalSubmissionsCardValue');
const pendingSubmissionsCardValue = document.getElementById('pendingSubmissionsCardValue');

// Filter Input Elements
const userSearchInput = document.getElementById('userSearchInput');
const publicCampaignSearchInput = document.getElementById('publicCampaignSearchInput');
const publicCampaignStatusFilter = document.getElementById('publicCampaignStatusFilter');
const submissionSearchInput = document.getElementById('submissionSearchInput');
const submissionStatusFilter = document.getElementById('submissionStatusFilter');
const userCampaignSearchInput = document.getElementById('userCampaignSearchInput');

// Chart instances - to destroy before re-rendering
let submissionsByStatusChartInstance = null;
let usersOverTimeChartInstance = null;


// --- Toast Notification ---
function showAdminToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("adminToastContainer") || createAdminToastContainer();
  const toast = document.createElement("div");
  toast.className = `admin-toast admin-toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  void toast.offsetWidth;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

function createAdminToastContainer() {
  let container = document.getElementById("adminToastContainer");
  if (!container) {
      container = document.createElement("div");
      container.id = "adminToastContainer";
      document.body.appendChild(container);
  }
  return container;
}

// --- Admin Authentication UI Management ---
function checkAdminAuthUi() {
    if (sessionStorage.getItem('hookdAdminAuthenticated') === 'true' && auth.currentUser) {
        adminLoginContainer.style.display = 'none';
        adminPanelContainer.style.display = 'flex';
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadInitialData);
        } else {
            loadInitialData();
        }
    } else {
        adminLoginContainer.style.display = 'block';
        adminPanelContainer.style.display = 'none';
    }
}

// --- Admin Login Logic ---
adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = adminUsernameInput.value;
    const password = adminPasswordInput.value;
    const loginButton = adminLoginForm.querySelector('button[type="submit"]');
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    adminLoginError.textContent = '';
    adminLoginError.style.display = 'none';

    try {
        const userCredential = await signInWithEmailAndPassword(auth, username, password);
        console.log("Admin signed in with Firebase:", userCredential.user.email);
        const idTokenResult = await userCredential.user.getIdTokenResult(true);

        if (idTokenResult.claims.admin === true) {
            console.log("Admin custom claim verified client-side.");
            sessionStorage.setItem('hookdAdminAuthenticated', 'true');
            checkAdminAuthUi();
            showAdminToast('Admin login successful!', 'success');
        } else {
            await signOut(auth);
            adminLoginError.textContent = 'Authenticated, but not authorized as admin.';
            adminLoginError.style.display = 'block';
            showAdminToast('Login failed: Not an authorized admin.', 'error');
            sessionStorage.removeItem('hookdAdminAuthenticated');
        }
    } catch (firebaseError) {
        console.error("Firebase Admin Sign-in Error:", firebaseError);
        const genericErrorMessage = "Incorrect email or password provided.";
        adminLoginError.textContent = `Login Error: ${genericErrorMessage}`;
        adminLoginError.style.display = 'block';
        showAdminToast(`Admin login failed: ${genericErrorMessage}`, 'error');
        sessionStorage.removeItem('hookdAdminAuthenticated');
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});

// --- Admin Logout Logic ---
adminLogoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("Admin signed out from Firebase.");
    } catch (error) {
        console.error("Firebase Admin Sign-out Error:", error);
        showAdminToast('Error signing out from Firebase. Proceeding with local logout.', 'error');
    }
    sessionStorage.removeItem('hookdAdminAuthenticated');
    showAdminToast('Logged out successfully.', 'info');
    checkAdminAuthUi();
    usersTableContainer.innerHTML = '';
    publicCampaignsTableContainer.innerHTML = '';
    submissionsTableContainer.innerHTML = '';
    userCampaignsTableContainer.innerHTML = '';
    if(totalUsersCardValue) totalUsersCardValue.textContent = '-';
    if(totalPublicCampaignsCardValue) totalPublicCampaignsCardValue.textContent = '-';
    if(totalSubmissionsCardValue) totalSubmissionsCardValue.textContent = '-';
    if(pendingSubmissionsCardValue) pendingSubmissionsCardValue.textContent = '-';
    if (submissionsByStatusChartInstance) {
        submissionsByStatusChartInstance.destroy();
        submissionsByStatusChartInstance = null;
    }
    if (usersOverTimeChartInstance) {
        usersOverTimeChartInstance.destroy();
        usersOverTimeChartInstance = null;
    }
});

// --- Tab Switching Logic ---
adminMenuButtons.forEach(button => {
    button.addEventListener('click', () => {
        if (button.id === 'adminLogoutBtn') return;
        adminMenuButtons.forEach(btn => btn.classList.remove('active'));
        adminTabSections.forEach(sec => sec.classList.remove('active'));
        button.classList.add('active');
        const activeSectionId = button.dataset.tab;
        const activeSection = document.getElementById(activeSectionId);
        if (activeSection) {
            activeSection.classList.add('active');
            if (auth.currentUser && sessionStorage.getItem('hookdAdminAuthenticated') === 'true') {
                switch(activeSectionId) {
                    case 'dashboard':
                        loadDashboardStats();
                        loadSubmissionsByStatusChart();
                        loadUsersOverTimeChart();
                        break;
                    case 'users':
                        loadUsers(userSearchInput.value);
                        break;
                    case 'campaigns':
                        loadPublicCampaigns(publicCampaignSearchInput.value, publicCampaignStatusFilter.value);
                        break;
                    case 'submissions':
                        loadSubmissions(submissionSearchInput.value, submissionStatusFilter.value);
                        break;
                    case 'user-campaigns':
                        loadUserCreatedCampaigns(userCampaignSearchInput.value);
                        break;
                }
            } else if (auth.currentUser) {
                 showAdminToast("Admin claim not verified. Please re-login.", "error");
                 signOut(auth).then(() => sessionStorage.removeItem('hookdAdminAuthenticated')).finally(checkAdminAuthUi);
            } else {
                showAdminToast("Admin not authenticated. Please log in.", "error");
                checkAdminAuthUi();
            }
        }
    });
});

// --- Data Loading and Rendering Functions ---
async function loadDashboardStats() {
    if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
        showAdminToast("Not authenticated as admin to load stats.", "error");
        return;
    }
    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        if(totalUsersCardValue) totalUsersCardValue.textContent = usersSnapshot.size.toString();
        const publicCampaignsSnapshot = await getDocs(collection(db, "publicCampaigns"));
        if(totalPublicCampaignsCardValue) totalPublicCampaignsCardValue.textContent = publicCampaignsSnapshot.size.toString();
        const submissionsSnapshot = await getDocs(collection(db, "engagements"));
        if(totalSubmissionsCardValue) totalSubmissionsCardValue.textContent = submissionsSnapshot.size.toString();
        const pendingSubmissionsQuery = query(collection(db, "engagements"), where("status", "==", "pending_verification"));
        const pendingSubmissionsSnapshot = await getDocs(pendingSubmissionsQuery);
        if(pendingSubmissionsCardValue) pendingSubmissionsCardValue.textContent = pendingSubmissionsSnapshot.size.toString();
    } catch (error) {
        console.error("Error loading dashboard stats:", error);
        showAdminToast(`Failed to load dashboard statistics: ${error.message}`, "error");
    }
}

async function loadSubmissionsByStatusChart() {
    if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
        showAdminToast("Not authenticated for chart data", "error"); return;
    }
    const chartElement = document.getElementById('submissionsByStatusChart');
    if (!chartElement) {
        console.warn("Chart element #submissionsByStatusChart not found");
        return;
    }
    try {
        const submissionsSnapshot = await getDocs(collection(db, "engagements"));
        let statusCounts = { pending_verification: 0, verified: 0, rejected: 0, };
        submissionsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status && statusCounts.hasOwnProperty(data.status)) {
                statusCounts[data.status]++;
            }
        });
        const options = {
            series: [{ name: 'Submissions', data: [statusCounts.pending_verification, statusCounts.verified, statusCounts.rejected] }],
            chart: { type: 'bar', height: 350, toolbar: { show: true, tools: { download: true } }, fontFamily: 'Inter, sans-serif', },
            plotOptions: { bar: { horizontal: false, columnWidth: '45%', distributed: true, borderRadius: 4, } },
            dataLabels: { enabled: true, formatter: function (val) { return val; } },
            stroke: { show: true, width: 2, colors: ['transparent'] },
            xaxis: { categories: ['Pending', 'Verified', 'Rejected'], labels: { style: { colors: '#34495e', fontSize: '13px' } } },
            yaxis: { title: { text: 'Number of Submissions', style: { color: '#34495e', fontWeight: 500 } }, labels: { style: { colors: '#34495e', fontSize: '13px' } } },
            fill: { opacity: 1 }, legend: { show: false }, colors: ['#f39c12', '#2ecc71', '#e74c3c'],
            tooltip: { y: { formatter: function (val) { return val + " submissions"; } }, theme: 'light' },
            grid: { borderColor: '#e0e0e0', strokeDashArray: 4, yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } }
        };
        if (submissionsByStatusChartInstance) submissionsByStatusChartInstance.destroy();
        submissionsByStatusChartInstance = new ApexCharts(chartElement, options);
        submissionsByStatusChartInstance.render();
    } catch (error) {
        console.error("Error loading submissions by status chart:", error);
        showAdminToast(`Failed to load submissions chart: ${error.message}`, "error");
        if(chartElement) chartElement.innerHTML = "<p style='text-align:center; color:var(--admin-accent);'>Could not load chart.</p>";
    }
}

async function loadUsersOverTimeChart() {
    if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
        showAdminToast("Not authenticated for chart data", "error"); return;
    }
    const chartElement = document.getElementById('usersOverTimeChart');
    if (!chartElement) { console.warn("Chart element #usersOverTimeChart not found"); return; }
    try {
        const usersSnapshot = await getDocs(query(collection(db, "users"), orderBy("createdAt", "asc")));
        let usersByMonth = {};
        usersSnapshot.forEach(docSnap => {
            const userData = docSnap.data();
            if (userData.createdAt && userData.createdAt.toDate) {
                const date = userData.createdAt.toDate();
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const yearMonth = `${year}-${month}`;
                usersByMonth[yearMonth] = (usersByMonth[yearMonth] || 0) + 1;
            } else if (typeof userData.createdAt === 'string' || typeof userData.createdAt === 'number') {
                 try {
                    const date = new Date(userData.createdAt);
                    if (!isNaN(date.getTime())) {
                        const year = date.getFullYear();
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        const yearMonth = `${year}-${month}`;
                        usersByMonth[yearMonth] = (usersByMonth[yearMonth] || 0) + 1;
                    } else { console.warn("Invalid date string for user:", docSnap.id, userData.createdAt); }
                } catch (dateError) { console.warn("Could not parse createdAt date for user:", docSnap.id, userData.createdAt, dateError); }
            }
        });
        const sortedMonths = Object.keys(usersByMonth).sort();
        const chartSeriesData = sortedMonths.map(month => usersByMonth[month]);
        const chartCategories = sortedMonths.map(month => {
            const [year, m] = month.split('-');
            return new Date(parseInt(year), parseInt(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
        });
        const options = {
            series: [{ name: 'New Users', data: chartSeriesData }],
            chart: { type: 'area', height: 350, zoom: { enabled: false }, toolbar: { show: true, tools: { download: true } }, fontFamily: 'Inter, sans-serif', },
            dataLabels: { enabled: false }, stroke: { curve: 'smooth', width: 2.5 },
            xaxis: { type: 'category', categories: chartCategories, labels: { style: { colors: '#34495e', fontSize: '13px' } } },
            yaxis: { title: { text: 'Number of New Users', style: { color: '#34495e', fontWeight: 500 } }, labels: { style: { colors: '#34495e', fontSize: '13px' } } },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.2, stops: [0, 90, 100] } },
            colors: [getComputedStyle(document.documentElement).getPropertyValue('--admin-primary').trim() || '#3498db'],
            tooltip: { x: { format: 'MMM yy' }, y: { formatter: function (val) { return val + " users"; } }, theme: 'light' },
            grid: { borderColor: '#e0e0e0', strokeDashArray: 4, }
        };
        if (usersOverTimeChartInstance) usersOverTimeChartInstance.destroy();
        usersOverTimeChartInstance = new ApexCharts(chartElement, options);
        usersOverTimeChartInstance.render();
    } catch (error) {
        console.error("Error loading users over time chart:", error);
        showAdminToast(`Failed to load users chart: ${error.message}`, "error");
        if(chartElement) chartElement.innerHTML = "<p style='text-align:center; color:var(--admin-accent);'>Could not load chart.</p>";
    }
}

async function loadUsers(searchTerm = '') {
    if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
        showAdminToast("Not authenticated as admin.", "error"); return;
    }
    usersTableContainer.innerHTML = '<p>Loading users...</p>';
    try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        let users = [];
        querySnapshot.forEach(docSnap => { users.push({ id: docSnap.id, ...docSnap.data() }); });
        if (searchTerm) {
            searchTerm = searchTerm.toLowerCase();
            users = users.filter(user =>
                user.email?.toLowerCase().includes(searchTerm) ||
                user.id?.toLowerCase().includes(searchTerm) ||
                user.name?.toLowerCase().includes(searchTerm)
            );
        }
        if (users.length === 0) { usersTableContainer.innerHTML = '<p>No users found.</p>'; return; }
        let tableHtml = `<table><thead><tr>
            <th>Email</th><th>Name</th><th>Created At</th>
            <th>Wallet Balance</th><th>Campaigns Count</th><th>Email Verified (Firebase)</th><th>Actions</th>
            </tr></thead><tbody>`;
        users.forEach(user => {
            const isEmailVerifiedByFirebase = user.emailVerified || false;
            let createdAtDate = 'N/A';
            if (user.createdAt && user.createdAt.toDate) { createdAtDate = user.createdAt.toDate().toLocaleDateString();
            } else if (user.createdAt) {
                 try { const parsedDate = new Date(user.createdAt); if (!isNaN(parsedDate.getTime())) createdAtDate = parsedDate.toLocaleDateString();
                } catch (e) { /* ignore */ }
            }
            tableHtml += `<tr>
                
                <td>${user.email || 'N/A'}</td><td>${user.name || 'N/A'}</td>
                <td>${createdAtDate}</td>
                <td>₹${user.wallet?.balance !== undefined ? user.wallet.balance.toFixed(2) : '0.00'}</td>
                <td>${user.campaigns?.length || 0}</td><td>${isEmailVerifiedByFirebase ? 'Yes' : 'No'}</td>
                <td class="actions-cell">
                    <button class="edit-btn" data-id="${user.id}" data-type="user" title="Edit User (Not Implemented)">Edit</button>
                    ${!isEmailVerifiedByFirebase ? `<button class="verify-btn" data-id="${user.id}" title="Manually Verify Email (Not Implemented - Requires Admin SDK)">Verify Email</button>` : ''}
                </td></tr>`;
        });
        tableHtml += '</tbody></table>';
        usersTableContainer.innerHTML = tableHtml;
    } catch (error) {
        console.error("Error loading users:", error);
        usersTableContainer.innerHTML = `<p>Error loading users: ${error.message}. Check console.</p>`;
        showAdminToast("Failed to load users.", "error");
    }
}

async function loadPublicCampaigns(searchTerm = '', statusFilter = '') {
    if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
        showAdminToast("Not authenticated as admin.", "error"); return;
    }
    publicCampaignsTableContainer.innerHTML = '<p>Loading public campaigns...</p>';
    try {
        let campaignsQueryConstraints = [];
        if (statusFilter) { campaignsQueryConstraints.push(where("status", "==", statusFilter)); }
        campaignsQueryConstraints.push(orderBy("createdAt", "desc"));
        const finalQuery = query(collection(db, "publicCampaigns"), ...campaignsQueryConstraints);
        const querySnapshot = await getDocs(finalQuery);
        let campaigns = [];
        querySnapshot.forEach(docSnap => { campaigns.push({ id: docSnap.id, ...docSnap.data() }); });
        if (searchTerm) {
            searchTerm = searchTerm.toLowerCase();
            campaigns = campaigns.filter(c =>
                c.id.toLowerCase().includes(searchTerm) || c.desc?.toLowerCase().includes(searchTerm) ||
                c.creatorName?.toLowerCase().includes(searchTerm) || c.url?.toLowerCase().includes(searchTerm)
            );
        }
        if (campaigns.length === 0) { publicCampaignsTableContainer.innerHTML = '<p>No public campaigns found matching criteria.</p>'; return; }
        let tableHtml = `<table><thead><tr>
            <th>ID</th><th>Description (Title)</th><th>Creator Name (ID)</th><th>URL</th>
            <th>Target Views</th><th>Current Views</th><th>Status</th><th>Created At</th><th>Actions</th>
            </tr></thead><tbody>`;
        campaigns.forEach(campaign => {
            let createdAtDate = 'N/A';
            if (campaign.createdAt && campaign.createdAt.toDate) { createdAtDate = campaign.createdAt.toDate().toLocaleString();
            } else if (campaign.createdAt) {
                try { const parsedDate = new Date(campaign.createdAt); if(!isNaN(parsedDate.getTime())) createdAtDate = parsedDate.toLocaleString();
                } catch(e) { /* ignore */ }
            }

            // Generate action buttons based on current status
            let actionButtonsHtml = '';
            const currentStatus = campaign.status || 'unknown';
            switch (currentStatus) {
                case 'pending_review':
                    actionButtonsHtml += `<button class="status-change-btn approve-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="active" title="Activate Campaign">Activate</button>`;
                    actionButtonsHtml += `<button class="status-change-btn reject-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="rejected" title="Reject Campaign">Reject</button>`;
                    break;
                case 'active':
                    actionButtonsHtml += `<button class="status-change-btn edit-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="pending_review" title="Deactivate to Pending">To Pending</button>`;
                    actionButtonsHtml += `<button class="status-change-btn approve-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="completed" title="Mark as Completed">Complete</button>`;
                    actionButtonsHtml += `<button class="status-change-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="archived" title="Archive Campaign" style="background-color:#6c757d; color:white;">Archive</button>`;
                    break;
                case 'rejected':
                    actionButtonsHtml += `<button class="status-change-btn edit-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="pending_review" title="Re-evaluate (Set to Pending)">Re-evaluate</button>`;
                    break;
                case 'completed':
                    actionButtonsHtml += `<button class="status-change-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="archived" title="Archive Campaign" style="background-color:#6c757d; color:white;">Archive</button>`;
                    break;
                case 'archived':
                    actionButtonsHtml += `<button class="status-change-btn edit-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="pending_review" title="Unarchive to Pending">To Pending</button>`;
                    break;
                default:
                    actionButtonsHtml += `<button class="status-change-btn edit-btn" data-id="${campaign.id}" data-creatorid="${campaign.creatorId || ''}" data-new-status="pending_review" title="Set to Pending Review">To Pending</button>`;
            }

            tableHtml += `<tr>
                <td>${campaign.id}</td><td>${campaign.desc || 'N/A'}</td>
                <td>${campaign.creatorName || 'N/A'} (${campaign.creatorId ? campaign.creatorId.substring(0,8) : 'N/A'}...)</td>
                <td><a href="${campaign.url}" target="_blank" rel="noopener noreferrer">${campaign.url ? campaign.url.substring(0,30) : 'N/A'}...</a></td>
                <td>${campaign.views || 0}</td><td>${campaign.currentViews || 0}</td>
                <td><span class="status-badge status-${currentStatus.toLowerCase().replace(/\s+/g, '_')}">${currentStatus.replace(/_/g, ' ')}</span></td>
                <td>${createdAtDate}</td>
                <td class="actions-cell">
                    ${actionButtonsHtml}
                    <button class="delete-btn" data-id="${campaign.id}" data-type="publicCampaign" title="Delete Campaign">Delete</button>
                </td></tr>`;
        });
        tableHtml += '</tbody></table>';
        publicCampaignsTableContainer.innerHTML = tableHtml;
        attachPublicCampaignActionListeners();
    } catch (error) {
        console.error("Error loading public campaigns:", error);
        publicCampaignsTableContainer.innerHTML = `<p>Error loading public campaigns: ${error.message}. Check console.</p>`;
        showAdminToast("Failed to load public campaigns.", "error");
    }
}

async function loadSubmissions(searchTerm = '', statusFilter = '') {
    if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
        showAdminToast("Not authenticated as admin.", "error"); return;
    }
    submissionsTableContainer.innerHTML = '<p>Loading submissions...</p>';
    try {
        let submissionsQueryConstraints = [];
        if (statusFilter) { submissionsQueryConstraints.push(where("status", "==", statusFilter)); }
        submissionsQueryConstraints.push(orderBy("submissionTimestamp", "desc"));
        const finalQuery = query(collection(db, "engagements"), ...submissionsQueryConstraints);
        const querySnapshot = await getDocs(finalQuery);
        let submissions = [];
        querySnapshot.forEach(docSnap => { submissions.push({ id: docSnap.id, ...docSnap.data() }); });
        if (searchTerm) {
            searchTerm = searchTerm.toLowerCase();
            submissions = submissions.filter(s =>
                s.id.toLowerCase().includes(searchTerm) || s.originalCampaignId?.toLowerCase().includes(searchTerm) ||
                s.engagingUserId?.toLowerCase().includes(searchTerm) || s.submittedLink?.toLowerCase().includes(searchTerm)
            );
        }
        if (submissions.length === 0) { submissionsTableContainer.innerHTML = '<p>No submissions found matching criteria.</p>'; return; }
        let tableHtml = `<table><thead><tr>
            <th>ID</th><th>Campaign ID</th><th>Engaging User (ID)</th><th>Submitted Link</th>
            <th>Status</th><th>Submitted At</th><th>Actual Views</th><th>Actions</th>
            </tr></thead><tbody>`;
        submissions.forEach(sub => {
            let submittedAtDate = 'N/A';
            if (sub.submissionTimestamp && sub.submissionTimestamp.toDate) { submittedAtDate = sub.submissionTimestamp.toDate().toLocaleString();
            } else if (sub.submissionTimestamp) {
                try { const parsedDate = new Date(sub.submissionTimestamp); if(!isNaN(parsedDate.getTime())) submittedAtDate = parsedDate.toLocaleString();
                } catch(e) { /* ignore */ }
            }
            tableHtml += `<tr>
                <td>${sub.id}</td><td>${sub.originalCampaignId || 'N/A'}</td>
                <td>${sub.engagingUserName || 'N/A'} (${sub.engagingUserId ? sub.engagingUserId.substring(0,8) : 'N/A'}...)</td>
                <td><a href="${sub.submittedLink}" target="_blank" rel="noopener noreferrer">${sub.submittedLink ? sub.submittedLink.substring(0,30) : 'N/A'}...</a></td>
                <td><span class="status-badge status-${(sub.status || 'unknown').toLowerCase().replace(/\s+/g, '_')}">${(sub.status || 'unknown').replace(/_/g, ' ')}</span></td>
                <td>${submittedAtDate}</td><td>${sub.actualViewsAchieved || 0}</td>
                <td class="actions-cell">
                    ${sub.status === 'pending_verification' ? `
                        <button class="approve-btn" data-id="${sub.id}" data-type="submission" title="Approve Submission">Approve</button>
                        <button class="reject-btn" data-id="${sub.id}" data-type="submission" title="Reject Submission">Reject</button>
                    ` : sub.status === 'verified' ? `
                         <button class="reject-btn" data-id="${sub.id}" data-type="submission" data-new-status="pending_verification" title="Revert to Pending">Revert</button>
                    ` : sub.status === 'rejected' ? `
                         <button class="approve-btn" data-id="${sub.id}" data-type="submission" data-new-status="pending_verification" title="Reconsider (Set to Pending)">Reconsider</button>
                    ` : ''}
                    <button class="edit-btn" data-id="${sub.id}" data-type="submission" title="Edit Submission (Not Implemented)">Edit</button>
                </td></tr>`;
        });
        tableHtml += '</tbody></table>';
        submissionsTableContainer.innerHTML = tableHtml;
        attachSubmissionActionListeners();
    } catch (error) {
        console.error("Error loading submissions:", error);
        submissionsTableContainer.innerHTML = `<p>Error loading submissions: ${error.message}. Check console.</p>`;
        showAdminToast("Failed to load submissions.", "error");
    }
}

async function loadUserCreatedCampaigns(searchTerm = '') {
    if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
        showAdminToast("Not authenticated as admin.", "error"); return;
    }
    userCampaignsTableContainer.innerHTML = '<p>Loading user-created campaigns... This can be slow for many users.</p>';
    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        let allUserCampaigns = [];
        usersSnapshot.forEach(userDocSnap => {
            const userData = userDocSnap.data();
            if (userData.campaigns && Array.isArray(userData.campaigns)) {
                userData.campaigns.forEach(campaign => {
                    allUserCampaigns.push({ userId: userDocSnap.id, userName: userData.name || userData.email, ...campaign });
                });
            }
        });
        if (searchTerm) {
            searchTerm = searchTerm.toLowerCase();
            allUserCampaigns = allUserCampaigns.filter(c =>
                c.userId.toLowerCase().includes(searchTerm) || c.userName?.toLowerCase().includes(searchTerm) ||
                c.id?.toLowerCase().includes(searchTerm) || c.desc?.toLowerCase().includes(searchTerm) ||
                c.url?.toLowerCase().includes(searchTerm)
            );
        }
        allUserCampaigns.sort((a,b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        if (allUserCampaigns.length === 0) { userCampaignsTableContainer.innerHTML = '<p>No user-created campaigns found matching criteria.</p>'; return; }
        let tableHtml = `<table><thead><tr>
            <th>User (ID)</th><th>Campaign ID</th><th>Description</th><th>URL</th>
            <th>Target Views</th><th>Current Views</th><th>Status</th><th>Created At</th><th>Actions</th>
            </tr></thead><tbody>`;
        allUserCampaigns.forEach(campaign => {
            let createdAtDate = 'N/A';
            if (campaign.createdAt && campaign.createdAt.toDate) { createdAtDate = campaign.createdAt.toDate().toLocaleString();
            } else if (campaign.createdAt) {
                try { const parsedDate = new Date(campaign.createdAt); if(!isNaN(parsedDate.getTime())) createdAtDate = parsedDate.toLocaleString();
                } catch(e) { /* ignore */ }
            }
            tableHtml += `<tr>
                <td>${campaign.userName} (${campaign.userId.substring(0,8)}...)</td><td>${campaign.id}</td>
                <td>${campaign.desc || 'N/A'}</td>
                <td><a href="${campaign.url}" target="_blank" rel="noopener noreferrer">${campaign.url ? campaign.url.substring(0,25) : 'N/A'}...</a></td>
                <td>${campaign.views || 0}</td><td>${campaign.currentViews || 0}</td>
                <td><span class="status-badge status-${(campaign.status || 'unknown').toLowerCase().replace(/\s+/g, '_')}">${(campaign.status || 'unknown').replace(/_/g, ' ')}</span></td>
                <td>${createdAtDate}</td>
                <td class="actions-cell">
                    <button class="edit-btn" data-id="${campaign.id}" data-userid="${campaign.userId}" data-type="userCampaign" title="Edit User Campaign (Not Implemented)">Edit</button>
                    <button class="delete-btn" data-id="${campaign.id}" data-userid="${campaign.userId}" data-type="userCampaign" title="Delete User Campaign">Delete</button>
                </td></tr>`;
        });
        tableHtml += '</tbody></table>';
        userCampaignsTableContainer.innerHTML = tableHtml;
        attachUserCampaignActionListeners();
    } catch (error) {
        console.error("Error loading user-created campaigns:", error);
        userCampaignsTableContainer.innerHTML = `<p>Error loading user campaigns: ${error.message}. Check console.</p>`;
        showAdminToast("Failed to load user campaigns.", "error");
    }
}

// --- Action Event Listeners ---
function attachSubmissionActionListeners() {
    submissionsTableContainer.querySelectorAll('.approve-btn, .reject-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
                showAdminToast("Not authenticated for action", "error"); return;
            }
            const submissionId = e.target.dataset.id;
            const isApprove = e.target.classList.contains('approve-btn');
            const newStatusFromData = e.target.dataset.newStatus;
            let newStatus = newStatusFromData || (isApprove ? 'verified' : 'rejected');
            if (!window.confirm(`Are you sure you want to set status to '${newStatus}' for submission ${submissionId}?`)) return;
            e.target.disabled = true;
            try {
                const submissionRef = doc(db, "engagements", submissionId);
                const updateData = { status: newStatus };
                const nowISO = new Date().toISOString();
                if (newStatus === 'verified') { updateData.verificationTimestamp = nowISO; updateData.rejectionTimestamp = null;
                } else if (newStatus === 'rejected') { updateData.rejectionTimestamp = nowISO; updateData.verificationTimestamp = null;
                } else if (newStatus === 'pending_verification') { updateData.verificationTimestamp = null; updateData.rejectionTimestamp = null; }
                await updateDoc(submissionRef, updateData);
                showAdminToast(`Submission ${submissionId} status updated to ${newStatus}.`, 'success');
                loadSubmissions(submissionSearchInput.value, submissionStatusFilter.value);
                loadDashboardStats();
                if (document.getElementById('dashboard').classList.contains('active')) { loadSubmissionsByStatusChart(); }
            } catch (error) {
                console.error(`Error updating submission ${submissionId}:`, error);
                showAdminToast(`Failed to update submission ${submissionId}: ${error.message}.`, 'error');
            } finally { e.target.disabled = false; }
        });
    });
    submissionsTableContainer.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            showAdminToast(`Edit for submission ${e.target.dataset.id} not implemented.`, 'info');
        });
    });
}

function attachPublicCampaignActionListeners() {
    publicCampaignsTableContainer.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            // ... (delete logic remains the same)
            if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
                showAdminToast("Not authenticated for action", "error"); return;
            }
            const campaignId = e.target.dataset.id;
            if (!window.confirm(`Are you sure you want to DELETE public campaign ${campaignId}? This is irreversible.`)) return;
            e.target.disabled = true;
            try {
                await deleteDoc(doc(db, "publicCampaigns", campaignId));
                showAdminToast(`Public campaign ${campaignId} deleted.`, 'success');
                loadPublicCampaigns(publicCampaignSearchInput.value, publicCampaignStatusFilter.value);
                loadDashboardStats();
            } catch (error) {
                console.error(`Error deleting public campaign ${campaignId}:`, error);
                showAdminToast(`Failed to delete public campaign ${campaignId}: ${error.message}.`, 'error');
            } finally { e.target.disabled = false; }
        });
    });

    // Attach to the new class '.status-change-btn'
    publicCampaignsTableContainer.querySelectorAll('.status-change-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
                showAdminToast("Not authenticated for action", "error"); return;
            }
            const campaignId = e.target.dataset.id;
            const creatorId = e.target.dataset.creatorid;
            const newStatus = e.target.dataset.newStatus; // Get new status directly from button

            if (!newStatus) {
                showAdminToast("Error: New status not defined for action.", "error");
                return;
            }
            
            // Confirmation for the action
            if (!window.confirm(`Are you sure you want to change status to '${newStatus.replace(/_/g, ' ')}' for campaign ${campaignId}?`)) return;

            e.target.disabled = true;
            const batch = writeBatch(db);

            const publicCampaignRef = doc(db, "publicCampaigns", campaignId);
            batch.update(publicCampaignRef, { status: newStatus });

            if (creatorId) {
                const userRef = doc(db, "users", creatorId);
                try {
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const userCampaigns = userData.campaigns || [];
                        const campaignIndex = userCampaigns.findIndex(c => c.id === campaignId);
                        if (campaignIndex !== -1) {
                            const updatedUserCampaigns = userCampaigns.map((camp, index) => {
                                if (index === campaignIndex) {
                                    return { ...camp, status: newStatus };
                                }
                                return camp;
                            });
                            batch.update(userRef, { campaigns: updatedUserCampaigns });
                        } else {
                            console.warn(`Campaign ID ${campaignId} not found in user ${creatorId}'s campaigns array.`);
                        }
                    } else {
                        console.warn(`User ${creatorId} not found for updating campaign status in user document.`);
                    }
                } catch (userError) {
                    console.error(`Error fetching/updating user ${creatorId} for campaign sync:`, userError);
                    showAdminToast(`Error syncing with user's campaign: ${userError.message}. Public campaign might still update.`, 'warning');
                }
            } else {
                console.warn(`No creatorId found for campaign ${campaignId}, cannot sync status to user document.`);
            }

            try {
                await batch.commit();
                showAdminToast(`Campaign ${campaignId} status updated to ${newStatus} and synced.`, 'success');
            } catch (batchError) {
                console.error(`Error committing batch update for campaign ${campaignId}:`, batchError);
                showAdminToast(`Failed to update campaign ${campaignId} fully: ${batchError.message}.`, 'error');
            } finally {
                loadPublicCampaigns(publicCampaignSearchInput.value, publicCampaignStatusFilter.value);
                if (creatorId && document.getElementById('user-campaigns').classList.contains('active')) {
                    loadUserCreatedCampaigns(userCampaignSearchInput.value);
                }
                // Re-enable all status change buttons for this row (or just the clicked one if preferred)
                const allRowButtons = e.target.closest('td.actions-cell').querySelectorAll('button');
                allRowButtons.forEach(btn => btn.disabled = false);
            }
        });
    });
}


function attachUserCampaignActionListeners() {
    userCampaignsTableContainer.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!auth.currentUser || sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
                showAdminToast("Not authenticated for action", "error"); return;
            }
            const campaignId = e.target.dataset.id;
            const userId = e.target.dataset.userid;
            if (!window.confirm(`DELETE campaign ${campaignId} for user ${userId}? This also attempts to remove its public listing if applicable.`)) return;
            e.target.disabled = true;
            try {
                const userRef = doc(db, "users", userId);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    showAdminToast(`User ${userId} not found.`, "error"); e.target.disabled = false; return;
                }
                let userData = userSnap.data();
                let campaigns = userData.campaigns || [];
                const campaignToDelete = campaigns.find(c => c.id === campaignId);
                const updatedCampaigns = campaigns.filter(c => c.id !== campaignId);

                const batch = writeBatch(db);
                batch.update(userRef, { campaigns: updatedCampaigns }); 

                if (campaignToDelete && (campaignToDelete.status === 'active' || campaignToDelete.status === 'pending_review' || campaignToDelete.isPublic)) { 
                    const publicCampaignRef = doc(db, "publicCampaigns", campaignId);
                    batch.delete(publicCampaignRef); 
                }

                await batch.commit(); 
                showAdminToast(`Campaign ${campaignId} removed from user ${userId} and public listing (if applicable).`, 'success');

                loadUserCreatedCampaigns(userCampaignSearchInput.value);
                loadDashboardStats();
                if (document.getElementById('campaigns').classList.contains('active')) { 
                    loadPublicCampaigns(publicCampaignSearchInput.value, publicCampaignStatusFilter.value);
                }
            } catch (error) {
                console.error(`Error deleting user campaign ${campaignId} for ${userId}:`, error);
                showAdminToast(`Failed to delete user campaign ${campaignId}: ${error.message}.`, 'error');
            } finally { e.target.disabled = false; }
        });
    });
    userCampaignsTableContainer.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            showAdminToast(`Edit for user campaign ${e.target.dataset.id} (user ${e.target.dataset.userid}) not implemented.`, 'info');
        });
    });
}

// --- Filter Event Listeners Setup ---
function addFilterListeners() {
    userSearchInput?.addEventListener('input', (e) => {
        if (auth.currentUser && sessionStorage.getItem('hookdAdminAuthenticated') === 'true') loadUsers(e.target.value);
    });
    publicCampaignSearchInput?.addEventListener('input', (e) => {
        if (auth.currentUser && sessionStorage.getItem('hookdAdminAuthenticated') === 'true') loadPublicCampaigns(e.target.value, publicCampaignStatusFilter.value);
    });
    publicCampaignStatusFilter?.addEventListener('change', (e) => {
        if (auth.currentUser && sessionStorage.getItem('hookdAdminAuthenticated') === 'true') loadPublicCampaigns(publicCampaignSearchInput.value, e.target.value);
    });
    submissionSearchInput?.addEventListener('input', (e) => {
        if (auth.currentUser && sessionStorage.getItem('hookdAdminAuthenticated') === 'true') loadSubmissions(e.target.value, submissionStatusFilter.value);
    });
    submissionStatusFilter?.addEventListener('change', (e) => {
        if (auth.currentUser && sessionStorage.getItem('hookdAdminAuthenticated') === 'true') loadSubmissions(submissionSearchInput.value, e.target.value);
    });
    userCampaignSearchInput?.addEventListener('input', (e) => {
        if (auth.currentUser && sessionStorage.getItem('hookdAdminAuthenticated') === 'true') loadUserCreatedCampaigns(e.target.value);
    });
}

// --- Initial Load and Auth State Change Handling ---
function loadInitialData() {
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }
    if (auth.currentUser && sessionStorage.getItem('hookdAdminAuthenticated') === 'true') {
        const activeTabButton = document.querySelector('.admin-menu button[data-tab].active');
        const defaultTab = 'dashboard';
        let currentTabId = defaultTab;
        if (activeTabButton && activeTabButton.dataset.tab) {
            currentTabId = activeTabButton.dataset.tab;
        } else {
            const dashboardButton = document.querySelector(`.admin-menu button[data-tab="${defaultTab}"]`);
            const dashboardSection = document.getElementById(defaultTab);
            if (dashboardButton) dashboardButton.classList.add('active');
            if (dashboardSection) dashboardSection.classList.add('active');
        }
        switch(currentTabId) {
            case 'dashboard': loadDashboardStats(); loadSubmissionsByStatusChart(); loadUsersOverTimeChart(); break;
            case 'users': loadUsers(userSearchInput.value); break;
            case 'campaigns': loadPublicCampaigns(publicCampaignSearchInput.value, publicCampaignStatusFilter.value); break;
            case 'submissions': loadSubmissions(submissionSearchInput.value, submissionStatusFilter.value); break;
            case 'user-campaigns': loadUserCreatedCampaigns(userCampaignSearchInput.value); break;
        }
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        user.getIdTokenResult(true)
            .then((idTokenResult) => {
                if (idTokenResult.claims.admin === true) {
                    console.log("Admin user confirmed by onAuthStateChanged and claim check.");
                    if (sessionStorage.getItem('hookdAdminAuthenticated') !== 'true') {
                        sessionStorage.setItem('hookdAdminAuthenticated', 'true');
                    }
                    checkAdminAuthUi();
                } else {
                    console.warn("User authenticated but lacks admin claim. Forcing logout.");
                    signOut(auth).catch(err => console.error("Error during forced sign out (no admin claim):", err));
                    sessionStorage.removeItem('hookdAdminAuthenticated');
                    checkAdminAuthUi();
                    showAdminToast("Not authorized as admin. Please login with an admin account.", "error");
                }
            }).catch(error => {
                console.error("Error getting ID token result in onAuthStateChanged:", error);
                signOut(auth).catch(err => console.error("Error during forced sign out (token error):", err));
                sessionStorage.removeItem('hookdAdminAuthenticated');
                checkAdminAuthUi();
            });
    } else {
        if (sessionStorage.getItem('hookdAdminAuthenticated') === 'true') {
            sessionStorage.removeItem('hookdAdminAuthenticated');
        }
        checkAdminAuthUi();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    addFilterListeners();
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }
    checkAdminAuthUi();
});
