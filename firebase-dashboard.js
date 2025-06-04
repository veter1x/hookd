import { firebaseConfig } from './firebase-config.js'; // Import the centralized config
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  arrayUnion,
  arrayRemove,
  updateDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Toast Notification Functions ---
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toast-container";
  document.body.appendChild(container);
  return container;
}
// --- End Toast Notification Functions ---

// --- Main Dashboard Element References ---
const campaignForm = document.querySelector(".campaign-form"); // For creating campaigns
const walletBalanceCardEl = document.getElementById("walletBalanceCard");
const campaignsRunningCardEl = document.getElementById("campaignsRunningCard");
const totalViewsCardEl = document.getElementById("totalViewsCard");
const campaignsListContainer = document.getElementById("campaignsList");
const earnCampaignsListContainer = document.getElementById("earnCampaignsList");

// --- Modal Element References (Engagement Submission) ---
const engagementModal = document.getElementById('engagementModal');
const modalCloseButton = document.querySelector('#engagementModal .modal-close-button');
const modalCampaignTitleEl = document.getElementById('modalCampaignTitle');
const modalCampaignDescriptionEl = document.getElementById('modalCampaignDescription');
const modalCampaignOriginalLinkEl = document.getElementById('modalCampaignOriginalLink');
const engagementLinkInputEl = document.getElementById('engagementLinkInput');
const engagementLinkErrorEl = document.getElementById('engagementLinkError');
const submitEngagementButtonEl = document.getElementById('submitEngagementButton');

// --- Modal Element References (Manage Submissions) ---
const manageSubmissionsModal = document.getElementById('manageSubmissionsModal');
const closeManageSubmissionsModalButton = document.getElementById('closeManageSubmissionsModal');
const manageSubmissionsModalTitleEl = document.getElementById('manageSubmissionsModalTitle');
const submissionsListContainerEl = document.getElementById('submissionsListContainer');

// --- Modal Element References (Edit Campaign) ---
const editCampaignModal = document.getElementById('editCampaignModal');
const closeEditCampaignModalButton = document.getElementById('closeEditCampaignModal');
const editCampaignForm = document.getElementById('editCampaignForm');
const editCampaignIdInput = document.getElementById('editCampaignId');
const editCampaignUrlInput = document.getElementById('editCampaignUrl');
const editCampaignViewsInput = document.getElementById('editCampaignViews');
const editCampaignDescInput = document.getElementById('editCampaignDesc');
const editCampaignUrlErrorEl = document.getElementById('editCampaignUrlError');
const editCampaignViewsErrorEl = document.getElementById('editCampaignViewsError');
const editCampaignDescErrorEl = document.getElementById('editCampaignDescError');
const saveCampaignChangesButtonEl = document.getElementById('saveCampaignChangesButton');


// --- Notification Banner Element References ---
const pendingVerificationsBannerEl = document.getElementById('pendingVerificationsBanner');
const pendingVerificationCountEl = document.getElementById('pendingVerificationCount');
const viewPendingVerificationsLinkEl = document.getElementById('viewPendingVerificationsLink');
const emailVerificationBannerEl = document.getElementById('emailVerificationBanner'); 
const resendVerificationEmailBtn = document.getElementById('resendVerificationEmailBtn'); 


// --- Form Error Message Element References (for create form) ---
let urlErrorEl, viewsErrorEl, descErrorEl;

function initializeErrorElements() {
    urlErrorEl = document.getElementById("url-error");
    viewsErrorEl = document.getElementById("views-error");
    descErrorEl = document.getElementById("desc-error");
}
if (campaignForm) initializeErrorElements();

// --- Global State Variables ---
let currentUser = null;
let userCampaigns = []; // Local cache for "My Campaigns"
let currentEngagingCampaignDetails = null; // For engagement submission modal
let currentManagingCampaignId = null; // For manage submissions modal
let currentManagingCampaignTitle = null; 
let campaignBeingEdited = null; // To store details of campaign being edited

// --- Helper Functions ---
function clearFormErrors() { // For create form
    if (urlErrorEl) urlErrorEl.textContent = "";
    if (viewsErrorEl) viewsErrorEl.textContent = "";
    if (descErrorEl) descErrorEl.textContent = "";
}
function clearEditCampaignFormErrors() {
    if(editCampaignUrlErrorEl) editCampaignUrlErrorEl.textContent = "";
    if(editCampaignViewsErrorEl) editCampaignViewsErrorEl.textContent = "";
    if(editCampaignDescErrorEl) editCampaignDescErrorEl.textContent = "";
}


// --- Rendering Functions ---
function renderMyCampaigns(campaigns = []) {
  userCampaigns = campaigns; // Update global cache
  if (!campaignsListContainer) {
    console.error("My Campaigns list container not found in DOM.");
    return;
  }
  campaignsListContainer.innerHTML = '';

  if (campaigns.length === 0) {
    const p = document.createElement("p");
    p.textContent = "You haven't created any campaigns yet. Click 'Create' to launch one!";
    p.setAttribute("data-no-campaigns-message", "true");
    campaignsListContainer.appendChild(p);
  } else {
    campaigns.forEach((campaign, index) => {
      const card = document.createElement("div");
      card.className = "campaign-card-visual";
      const campaignId = campaign.id || campaign.createdAt || `campaign-my-${index}`; 
      const currentViews = campaign.currentViews || 0;
      const targetViews = parseInt(campaign.views) || 0;
      const progressPercent = targetViews > 0 ? (currentViews / targetViews) * 100 : 0;
      const campaignTitle = campaign.desc || "Untitled Campaign";
      const campaignStatusText = campaign.status || "Unknown";
      const safeTitle = campaignTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeTitleAttr = campaignTitle.replace(/"/g, "&quot;").replace(/'/g, "&#39;");


      card.innerHTML = `
        <div class="card-header">
          <div class="campaign-info">
            <div class="campaign-thumbnail"><i data-lucide="youtube"></i></div>
            <span class="campaign-title" title="${safeTitleAttr}">${safeTitle}</span>
          </div>
          <div class="header-right-content">
            <span class="current-views-badge">Views: ${currentViews.toLocaleString()}</span>
            <div class="campaign-actions">
              <button class="menu-button" aria-label="Campaign Actions" data-campaign-id="${campaignId}"><i data-lucide="more-vertical"></i></button>
              <div class="actions-dropdown" style="display: none;">
                <button class="edit-button" data-campaign-id="${campaignId}">Edit</button>
                <button class="delete-button" data-campaign-id="${campaignId}">Delete</button>
              </div>
            </div>
          </div>
        </div>
        <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${progressPercent.toFixed(2)}%;"></div></div>
        <div class="card-footer">
          <span class="campaign-category">Type: Video Promotion</span>
          <span class="target-views-info">Target: <strong>${targetViews.toLocaleString()}</strong></span>
        </div>
        <div class="status-text">Status: <span class="status-badge status-${campaignStatusText.toLowerCase().replace(/\s+/g, '_')}">${campaignStatusText.replace(/_/g, ' ')}</span></div>
        <div class="manage-submissions-footer">
            <button class="manage-submissions-button button-secondary" data-campaign-id="${campaignId}" data-campaign-title="${safeTitleAttr}">
                View Submissions
            </button>
        </div>
      `;
      campaignsListContainer.appendChild(card);
    });
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderEarnMoneyCampaigns(publicCampaigns = []) {
  if (!earnCampaignsListContainer) {
    console.error("Earn campaigns container not found!");
    return;
  }
  earnCampaignsListContainer.innerHTML = '';

  const existingNoCampaignsMessage = earnCampaignsListContainer.querySelector('[data-no-campaigns-message="true"]');
  if (existingNoCampaignsMessage) {
    existingNoCampaignsMessage.remove();
  }

  if (publicCampaigns.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No earning opportunities available at the moment. Check back soon!";
    p.setAttribute("data-no-campaigns-message", "true");
    earnCampaignsListContainer.appendChild(p);
  } else {
    publicCampaigns.forEach(campaign => {
      const card = document.createElement("div");
      card.className = "campaign-card-visual earn-campaign-card";

      const targetViews = parseInt(campaign.views) || 0;
      const actualCampaignDescription = campaign.desc || "No description provided."; 
      const creatorName = campaign.creatorName || 'Unknown Creator';
      
      const cardDisplayTitle = `${creatorName}'s Hook`;
      const shortDisplayTitle = cardDisplayTitle.length > 50 ? cardDisplayTitle.substring(0, 47) + "..." : cardDisplayTitle;

      const safeShortDisplayTitle = shortDisplayTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeActualCampaignDescription = actualCampaignDescription.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const campaignUrl = campaign.url || "#";
      const campaignDocId = campaign.id;

      const campaignDetailsForModal = {
          title: actualCampaignDescription, 
          description: campaign.fullDescription || actualCampaignDescription,
          originalLink: campaignUrl,
          publicCampaignId: campaignDocId,
          originalCampaignCreatorId: campaign.creatorId
      };

      card.innerHTML = `
        <div class="card-header">
          <div class="campaign-info">
            <div class="campaign-thumbnail">
              <i data-lucide="external-link"></i>
            </div>
            <span class="campaign-title" title="${safeShortDisplayTitle}">${safeShortDisplayTitle}</span>
          </div>
          <span class="target-views-badge">Target: ${targetViews.toLocaleString()} views</span>
        </div>
        <div class="earn-campaign-description-area"> 
          <p>${safeActualCampaignDescription}</p>
        </div>
        <div class="card-footer earn-footer">
          <button class="engage-button button-primary" 
                  data-campaign-details='${JSON.stringify(campaignDetailsForModal).replace(/'/g, "&#39;")}'> 
            Engage & Submit
          </button>
        </div>
      `;
      earnCampaignsListContainer.appendChild(card);
    });
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- Modal Functions (Engagement Submission) ---
function openEngagementModal(campaignDetails) {
  if (!engagementModal || !modalCampaignTitleEl || !modalCampaignDescriptionEl || !modalCampaignOriginalLinkEl || !engagementLinkInputEl) {
    console.error("Engagement Modal elements not found!");
    return;
  }
  modalCampaignTitleEl.textContent = campaignDetails.title;
  modalCampaignDescriptionEl.textContent = campaignDetails.description;
  modalCampaignOriginalLinkEl.textContent = campaignDetails.originalLink;
  modalCampaignOriginalLinkEl.href = campaignDetails.originalLink;
  engagementLinkInputEl.value = '';
  if (engagementLinkErrorEl) engagementLinkErrorEl.textContent = '';
  currentEngagingCampaignDetails = campaignDetails;
  engagementModal.style.display = 'flex';
}

function closeEngagementModal() {
  if (engagementModal) {
    engagementModal.style.display = 'none';
    currentEngagingCampaignDetails = null;
  }
}

// --- Modal Functions (Manage Submissions) ---
async function openManageSubmissionsModal(campaignId, campaignTitle) {
  if (!manageSubmissionsModal || !manageSubmissionsModalTitleEl || !submissionsListContainerEl) {
    console.error("Manage Submissions Modal elements not found!");
    return;
  }
  console.log("Attempting to manage submissions for campaignId:", campaignId);
  console.log("Current user UID for query:", currentUser ? currentUser.uid : "No current user");
  if (manageSubmissionsModalTitleEl) {
    manageSubmissionsModalTitleEl.dataset.campaignId = campaignId;
  }
  currentManagingCampaignId = campaignId;
  currentManagingCampaignTitle = campaignTitle;
  manageSubmissionsModalTitleEl.textContent = `Submissions for: ${campaignTitle}`;
  submissionsListContainerEl.innerHTML = '<p data-no-verifications-message="true">Loading submissions...</p>';
  manageSubmissionsModal.style.display = 'flex';
  try {
    const engagementsRef = collection(db, "engagements");
    if (!currentUser || !currentUser.uid) {
        console.error("Current user not available for querying submissions.");
        submissionsListContainerEl.innerHTML = '<p data-no-verifications-message="true">Error: User not identified. Cannot load submissions.</p>';
        return;
    }
    const q = query(engagementsRef,
                    where("originalCampaignId", "==", campaignId),
                    where("originalCampaignCreatorId", "==", currentUser.uid)
                  );
    const querySnapshot = await getDocs(q);
    renderSubmissionsInModal(querySnapshot.docs);
  } catch (error) {
    console.error("Detailed error fetching submissions:", error);
    console.error("Error fetching submissions for campaign:", campaignId, error.message);
    submissionsListContainerEl.innerHTML = '<p data-no-verifications-message="true">Could not load submissions. Please try again. Check console for details.</p>';
    showToast("Failed to load submissions.", "error");
  }
}

function renderSubmissionsInModal(submissionDocs) {
  if (!submissionsListContainerEl) return;
  submissionsListContainerEl.innerHTML = '';
  if (submissionDocs.length === 0) {
    submissionsListContainerEl.innerHTML = '<p data-no-verifications-message="true">No submissions found for this campaign yet.</p>';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'submission-items-list';
  submissionDocs.forEach(doc => {
    const submissionData = doc.data();
    const submissionId = doc.id;
    const li = document.createElement('li');
    li.className = 'submission-item';
    li.dataset.submissionId = submissionId;
    const safeSubmittedLink = (submissionData.submittedLink || '#').replace(/'/g, "&#39;");
    const safeEngagingUserName = (submissionData.engagingUserName || 'Unknown User').replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const currentStatus = submissionData.status || 'unknown';
    const submissionTime = submissionData.submissionTimestamp ? new Date(submissionData.submissionTimestamp).toLocaleString() : 'N/A';
    const actualViews = submissionData.actualViewsAchieved || 0;
    li.innerHTML = `
      <div class="submission-details">
        <p><strong>Submitted Link:</strong> <a href="${safeSubmittedLink}" target="_blank" rel="noopener noreferrer">${safeSubmittedLink}</a></p>
        <p><strong>Submitted By:</strong> ${safeEngagingUserName}</p>
        <p><strong>Status:</strong> <span class="submission-status status-badge status-${currentStatus.toLowerCase().replace(/\s+/g, '_')}">${currentStatus.replace(/_/g, ' ')}</span></p>
        ${currentStatus === 'verified' ? `<p><strong>Tracked Views:</strong> ${actualViews.toLocaleString()}</p>` : ''}
        <p class="submission-time"><em>Submitted: ${submissionTime}</em></p>
      </div>
      <div class="submission-actions">
        ${currentStatus === 'pending_verification' ? `
          <button class="approve-submission-button button-success" data-submission-id="${submissionId}">Approve</button>
          <button class="deny-submission-button button-danger" data-submission-id="${submissionId}">Deny</button>
        ` : currentStatus === 'verified' ? `
          <button class="revoke-submission-button button-warning" data-submission-id="${submissionId}">Revoke Approval</button>
        ` : currentStatus === 'rejected' ? `
          <button class="reconsider-submission-button button-secondary" data-submission-id="${submissionId}">Reconsider</button>
        ` : ''}
      </div>
    `;
    ul.appendChild(li);
  });
  submissionsListContainerEl.appendChild(ul);
}

function closeManageSubmissionsModal() {
  if (manageSubmissionsModal) {
    manageSubmissionsModal.style.display = 'none';
    currentManagingCampaignId = null;
    currentManagingCampaignTitle = null;
  }
}

// --- Modal Functions (Edit Campaign) ---
function openEditCampaignModal(campaign) {
  if (!editCampaignModal || !editCampaignForm || !editCampaignIdInput || !editCampaignUrlInput || !editCampaignViewsInput || !editCampaignDescInput) {
    console.error("Edit Campaign Modal elements not found!");
    return;
  }
  campaignBeingEdited = campaign; 
  editCampaignIdInput.value = campaign.id; 
  editCampaignUrlInput.value = campaign.url;
  editCampaignViewsInput.value = campaign.views;
  editCampaignDescInput.value = campaign.desc;
  clearEditCampaignFormErrors(); 
  editCampaignModal.style.display = 'flex';
}

function closeEditCampaignModal() {
  if (editCampaignModal) {
    editCampaignModal.style.display = 'none';
    campaignBeingEdited = null; 
    if(editCampaignForm) editCampaignForm.reset(); 
    clearEditCampaignFormErrors();
  }
}


// --- Data Loading Functions ---
async function loadAllCampaignsForEarning() {
  if (!earnCampaignsListContainer) {
    console.error("Earn campaigns list container not found.");
    return;
  }
  earnCampaignsListContainer.innerHTML = '<p data-no-campaigns-message="true">Loading available campaigns...</p>';
  let allCampaignsForEarning = [];
  try {
    const publicCampaignsRef = collection(db, "publicCampaigns");
    const q = query(publicCampaignsRef, where("status", "in", ["active", "pending_review"]));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(doc => {
      allCampaignsForEarning.push({ id: doc.id, ...doc.data() });
    });
    allCampaignsForEarning.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderEarnMoneyCampaigns(allCampaignsForEarning);
  } catch (error) {
    console.error("Error loading public campaigns for earning:", error);
    showToast("Failed to load available campaigns. Check console.", "error");
    if (earnCampaignsListContainer) {
        earnCampaignsListContainer.innerHTML = '<p data-no-campaigns-message="true">Could not load campaigns. Please try again later.</p>';
    }
  }
}

async function loadUserDashboardData(userId) {
  if (!userId) {
    console.warn("loadUserDashboardData called without userId");
    return;
  }
  const userRef = doc(db, "users", userId);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      renderMyCampaigns(userData.campaigns || []); 
      if (campaignsRunningCardEl) campaignsRunningCardEl.textContent = `Total Campaigns: ${(userData.campaigns || []).length}`;
      if (walletBalanceCardEl) walletBalanceCardEl.textContent = `Wallet Balance: ₹${userData.wallet?.balance || 0}`;
      let totalEarnedViews = 0;
      let pendingVerificationsCount = 0;
      try {
        const engagementsRef = collection(db, "engagements");
        const qEarned = query(engagementsRef, where("engagingUserId", "==", userId), where("status", "==", "verified"));
        const earnedSnap = await getDocs(qEarned);
        earnedSnap.forEach(engagementDoc => {
            totalEarnedViews += (engagementDoc.data().actualViewsAchieved || 0); 
        });
      } catch (engagementError) {
        console.error("Error fetching verified engagements for total views:", engagementError);
      }
      if (totalViewsCardEl) totalViewsCardEl.textContent = `Total Views Earned: ${totalEarnedViews.toLocaleString()}`;
      try {
        const engagementsRef = collection(db, "engagements");
        const qPending = query(engagementsRef, where("originalCampaignCreatorId", "==", userId), where("status", "==", "pending_verification"));
        const pendingSnap = await getDocs(qPending);
        pendingVerificationsCount = pendingSnap.size;
      } catch (pendingError) {
        console.error("Error fetching pending verifications:", pendingError);
        if (pendingVerificationsBannerEl) pendingVerificationsBannerEl.style.display = 'none';
      }
      if (pendingVerificationsBannerEl && pendingVerificationCountEl) {
        if (pendingVerificationsCount > 0) {
          pendingVerificationCountEl.textContent = pendingVerificationsCount;
          pendingVerificationsBannerEl.style.display = 'block';
        } else {
          pendingVerificationsBannerEl.style.display = 'none';
        }
      }
        const profileInfo = document.getElementById("profileInfo");
        if (profileInfo && currentUser) {
        profileInfo.innerHTML = `
            <p><strong>Email:</strong> ${currentUser.email || "N/A"}</p>
            <p><strong>User ID:</strong> ${currentUser.uid}</p>
            <p><strong>Name:</strong> ${userData.name || currentUser.displayName || "Not set"}</p>
            <p><strong>Email Verified:</strong> <span style="color: ${currentUser.emailVerified ? '#10b981' : '#f59e0b'};">${currentUser.emailVerified ? 'Yes' : 'No'}</span></p>
        `;
        }
        if (emailVerificationBannerEl) {
            if (currentUser && !currentUser.emailVerified) {
                emailVerificationBannerEl.style.display = 'block';
            } else {
                emailVerificationBannerEl.style.display = 'none';
            }
        }
    } else {
      renderMyCampaigns([]);
      if (pendingVerificationsBannerEl) pendingVerificationsBannerEl.style.display = 'none';
      if (emailVerificationBannerEl) emailVerificationBannerEl.style.display = 'none';
      console.warn("User document not found for UID:", userId);
    }
  } catch (error) {
    console.error("Error loading user dashboard data:", error);
    showToast("Failed to load dashboard data.", "error");
    renderMyCampaigns([]);
    if (pendingVerificationsBannerEl) pendingVerificationsBannerEl.style.display = 'none';
    if (emailVerificationBannerEl) emailVerificationBannerEl.style.display = 'none';
  }
}

// --- Event Listeners ---
// My Campaigns Actions (Edit/Delete Menu & Manage Submissions)
if (campaignsListContainer) {
  campaignsListContainer.addEventListener('click', async function(event) {
    const target = event.target.closest('button'); 
    if (!target) return; 
    const menuButton = target.classList.contains('menu-button') ? target : null;
    const editButton = target.classList.contains('edit-button') ? target : null;
    const deleteButton = target.classList.contains('delete-button') ? target : null;
    const manageButton = target.classList.contains('manage-submissions-button') ? target : null;

    if (menuButton) {
      event.stopPropagation();
      const dropdown = menuButton.nextElementSibling;
      if (dropdown && dropdown.classList.contains('actions-dropdown')) {
        const isCurrentlyOpen = dropdown.style.display === 'block';
        campaignsListContainer.querySelectorAll('.actions-dropdown').forEach(d => d.style.display = 'none');
        dropdown.style.display = isCurrentlyOpen ? 'none' : 'block';
      }
    } else if (editButton) {
      event.stopPropagation(); 
      const campaignId = editButton.dataset.campaignId;
      const campaignToEdit = userCampaigns.find(c => (c.id || c.createdAt) === campaignId);       
      if (campaignToEdit) {
        openEditCampaignModal(campaignToEdit);
      } else {
        showToast("Could not find campaign details to edit.", "error");
      }
      const dropdown = editButton.closest('.actions-dropdown');
      if (dropdown) dropdown.style.display = 'none';
    } else if (deleteButton) {
      event.stopPropagation();
      const campaignId = deleteButton.dataset.campaignId;
      if (confirm(`Delete campaign (ID: ${campaignId})? This cannot be undone.`)) {
        try {
          if (!currentUser) { showToast("Not logged in.", "error"); return; }
          const userRef = doc(db, "users", currentUser.uid);
          const campaignToDelete = userCampaigns.find(c => (c.id || c.createdAt || `campaign-${userCampaigns.indexOf(c)}`) === campaignId);
          if (campaignToDelete) {
            await updateDoc(userRef, { campaigns: arrayRemove(campaignToDelete) });
            const updatedUserSnap = await getDoc(userRef);
            if (updatedUserSnap.exists()) {
              const updatedUserData = updatedUserSnap.data();
              renderMyCampaigns(updatedUserData.campaigns || []);
              if (campaignsRunningCardEl) campaignsRunningCardEl.textContent = `Total Campaigns: ${(updatedUserData.campaigns || []).length}`;
            }
            showToast("Campaign deleted! Public listing updates via backend.", "success");
          } else { showToast("Campaign not found for deletion.", "error"); }
        } catch (error) { console.error("Error deleting campaign:", error); showToast("Failed to delete campaign.", "error"); }
      }
      if (deleteButton.closest('.actions-dropdown')) deleteButton.closest('.actions-dropdown').style.display = 'none';
    } else if (manageButton) {
        event.preventDefault();
        const campaignId = manageButton.dataset.campaignId;
        const campaignTitle = manageButton.dataset.campaignTitle;
        if (campaignId && campaignTitle) {
            openManageSubmissionsModal(campaignId, campaignTitle);
        } else {
            showToast("Campaign details missing for managing submissions.", "error");
        }
    }
  });
}

// Earn Money Tab - Engage Button Click
if (earnCampaignsListContainer) {
  earnCampaignsListContainer.addEventListener('click', function(event) {
    const engageButton = event.target.closest('.engage-button.button-primary');
    if (engageButton) {
      event.preventDefault();
      const campaignDetailsString = engageButton.dataset.campaignDetails;
      if (campaignDetailsString) {
        try {
          const campaignDetails = JSON.parse(campaignDetailsString.replace(/&#39;/g, "'"));
          openEngagementModal(campaignDetails);
        } catch (e) {
          console.error("Error parsing campaign details for modal:", e);
          showToast("Could not load campaign details. Please try again.", "error");
        }
      } else {
        showToast("Campaign details not found on button.", "error");
      }
    }
  });
}

// Modal Close Buttons
if (modalCloseButton) { 
  modalCloseButton.addEventListener('click', closeEngagementModal);
}
if (closeManageSubmissionsModalButton) { 
    closeManageSubmissionsModalButton.addEventListener('click', closeManageSubmissionsModal);
}
if (closeEditCampaignModalButton) { 
    closeEditCampaignModalButton.addEventListener('click', closeEditCampaignModal);
}


// Modal Overlay Click to Close
if (engagementModal) {
  engagementModal.addEventListener('click', (event) => {
    if (event.target === engagementModal) closeEngagementModal();
  });
}
if (manageSubmissionsModal) {
    manageSubmissionsModal.addEventListener('click', (event) => {
        if (event.target === manageSubmissionsModal) closeManageSubmissionsModal();
    });
}
if (editCampaignModal) { 
    editCampaignModal.addEventListener('click', (event) => {
        if (event.target === editCampaignModal) closeEditCampaignModal();
    });
}


// Engagement Modal Submission Button
if (submitEngagementButtonEl) {
  submitEngagementButtonEl.addEventListener('click', async () => {
    if (!currentUser) {
      showToast("You must be logged in to submit an engagement.", "error");
      closeEngagementModal();
      return;
    }
    if (!currentEngagingCampaignDetails || !currentEngagingCampaignDetails.publicCampaignId) {
      showToast("No campaign selected or campaign ID missing. Please close and retry.", "error");
      return;
    }
    const submittedLink = engagementLinkInputEl.value.trim();
    if (engagementLinkErrorEl) engagementLinkErrorEl.textContent = '';
    let isValidLink = true;
    if (!submittedLink) {
      if (engagementLinkErrorEl) engagementLinkErrorEl.textContent = "Your engagement link is required.";
      isValidLink = false;
    } else {
      try { new URL(submittedLink); } 
      catch (_) { if (engagementLinkErrorEl) engagementLinkErrorEl.textContent = "Please enter a valid URL."; isValidLink = false; }
    }
    if (!isValidLink) { showToast("Please correct the link error.", "error"); return; }
    showToast("Submitting your engagement...", "info");
    submitEngagementButtonEl.disabled = true;
    submitEngagementButtonEl.textContent = "Submitting...";
    try {
      const engagementData = {
        originalCampaignId: currentEngagingCampaignDetails.publicCampaignId,
        originalCampaignCreatorId: currentEngagingCampaignDetails.originalCampaignCreatorId,
        engagingUserId: currentUser.uid,
        engagingUserName: currentUser.displayName || currentUser.email.split('@')[0],
        submittedLink: submittedLink,
        submissionTimestamp: new Date().toISOString(),
        status: "pending_verification",
        actualViewsAchieved: 0 
      };
      const newEngagementRef = await addDoc(collection(db, "engagements"), engagementData);
      console.log("Engagement submitted with ID:", newEngagementRef.id);
      showToast("Your engagement has been submitted for verification!", "success");
      closeEngagementModal();
      if (currentUser) await loadUserDashboardData(currentUser.uid); 
    } catch (error) {
        console.error("Error submitting engagement to Firestore:", error);
        showToast("Failed to submit engagement. Please try again.", "error");
    } finally {
        submitEngagementButtonEl.disabled = false;
        submitEngagementButtonEl.textContent = "Submit My Engagement";
    }
  });
}

// Event Delegation for Approve/Deny/Revoke/Reconsider buttons within the Manage Submissions Modal
if (submissionsListContainerEl) {
  submissionsListContainerEl.addEventListener('click', async (event) => {
    const targetButton = event.target.closest('button');
    if (!targetButton) return;
    const submissionId = targetButton.dataset.submissionId;
    if (!submissionId) return;

    if (targetButton.classList.contains('approve-submission-button')) {
      if (!confirm("Are you sure you want to approve this submission? Its views will be tracked by the system.")) return;
      showToast(`Approving submission ${submissionId}...`, "info");
      targetButton.disabled = true;
      const engagementRef = doc(db, "engagements", submissionId);
      try {
        await updateDoc(engagementRef, { status: "verified", verificationTimestamp: new Date().toISOString(), actualViewsAchieved: 0 });
        showToast("Submission approved! View tracking will be updated by the system.", "success");
        if (currentManagingCampaignId && currentManagingCampaignTitle) openManageSubmissionsModal(currentManagingCampaignId, currentManagingCampaignTitle);
        if(currentUser) await loadUserDashboardData(currentUser.uid); 
      } catch (err) { console.error("Error approving submission:", err); showToast("Failed to approve submission.", "error"); targetButton.disabled = false; }
    } else if (targetButton.classList.contains('deny-submission-button')) {
      if (!confirm("Are you sure you want to deny this submission?")) return;
      showToast(`Denying submission ${submissionId}...`, "info");
      targetButton.disabled = true;
      const engagementRef = doc(db, "engagements", submissionId);
      try {
        await updateDoc(engagementRef, { status: "rejected", rejectionTimestamp: new Date().toISOString(), actualViewsAchieved: 0 });
        showToast("Submission denied.", "success");
        if (currentManagingCampaignId && currentManagingCampaignTitle) openManageSubmissionsModal(currentManagingCampaignId, currentManagingCampaignTitle);
        if(currentUser) await loadUserDashboardData(currentUser.uid); 
      } catch (err) { console.error("Error denying submission:", err); showToast("Failed to deny submission.", "error"); targetButton.disabled = false; }
    } else if (targetButton.classList.contains('revoke-submission-button')) {
      if (!confirm("Revoke approval? Status will be 'pending verification', and tracked views reset.")) return;
      showToast(`Revoking approval for ${submissionId}...`, "info");
      targetButton.disabled = true;
      const engagementRef = doc(db, "engagements", submissionId);
      try {
        await updateDoc(engagementRef, { status: "pending_verification", actualViewsAchieved: 0 });
        showToast("Approval revoked.", "success");
        if (currentManagingCampaignId && currentManagingCampaignTitle) openManageSubmissionsModal(currentManagingCampaignId, currentManagingCampaignTitle);
        if(currentUser) await loadUserDashboardData(currentUser.uid);
      } catch (err) { console.error("Error revoking submission:", err); showToast("Failed to revoke approval.", "error"); targetButton.disabled = false; }
    } else if (targetButton.classList.contains('reconsider-submission-button')) {
      if (!confirm("Move this submission back to 'pending verification'?")) return;
      showToast(`Reconsidering submission ${submissionId}...`, "info");
      targetButton.disabled = true;
      const engagementRef = doc(db, "engagements", submissionId);
      try {
        await updateDoc(engagementRef, { status: "pending_verification", actualViewsAchieved: 0 });
        showToast("Submission moved back to pending.", "success");
        if (currentManagingCampaignId && currentManagingCampaignTitle) openManageSubmissionsModal(currentManagingCampaignId, currentManagingCampaignTitle);
        if(currentUser) await loadUserDashboardData(currentUser.uid);
      } catch (err) { console.error("Error reconsidering submission:", err); showToast("Failed to reconsider submission.", "error"); targetButton.disabled = false; }
    }
  });
}

// --- Edit Campaign Modal Form Submission ---
if (editCampaignForm) {
    editCampaignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || !campaignBeingEdited || !campaignBeingEdited.id) {
            showToast("Error: No campaign selected for editing or user not logged in.", "error");
            closeEditCampaignModal();
            return;
        }
        clearEditCampaignFormErrors();

        const campaignIdToUpdate = campaignBeingEdited.id;
        const newUrl = editCampaignUrlInput.value.trim();
        const newViewsStr = editCampaignViewsInput.value.trim();
        const newDesc = editCampaignDescInput.value.trim();
        let isValid = true;

        if (!newUrl) { if(editCampaignUrlErrorEl) editCampaignUrlErrorEl.textContent = "URL is required."; isValid = false; }
        else { try { new URL(newUrl); } catch (_) { if(editCampaignUrlErrorEl) editCampaignUrlErrorEl.textContent = "Valid URL format required."; isValid = false;}}
        
        let newViewsNum;
        if (!newViewsStr) { if(editCampaignViewsErrorEl) editCampaignViewsErrorEl.textContent = "Target views required."; isValid = false; }
        else { newViewsNum = parseInt(newViewsStr); if (isNaN(newViewsNum) || newViewsNum <= 0) { if(editCampaignViewsErrorEl) editCampaignViewsErrorEl.textContent = "Views must be positive number."; isValid = false; }}
        
        if (!newDesc) { if(editCampaignDescErrorEl) editCampaignDescErrorEl.textContent = "Description required."; isValid = false; }
        else if (newDesc.length < 10 || newDesc.length > 200) { if(editCampaignDescErrorEl) editCampaignDescErrorEl.textContent = "Desc between 10-200 chars."; isValid = false; }

        if (!isValid) { showToast("Please correct the errors in the edit form.", "error"); return; }

        const updatedCampaignDataForUser = {
            ...campaignBeingEdited, 
            url: newUrl,
            views: newViewsNum,
            desc: newDesc,
            updatedAt: new Date().toISOString()
        };

        if(saveCampaignChangesButtonEl) {
            saveCampaignChangesButtonEl.disabled = true;
            saveCampaignChangesButtonEl.textContent = "Saving...";
        }

        try {
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                let currentCampaignsArray = userSnap.data().campaigns || [];
                const campaignIndex = currentCampaignsArray.findIndex(c => c.id === campaignIdToUpdate);

                if (campaignIndex > -1) {
                    currentCampaignsArray[campaignIndex] = updatedCampaignDataForUser;
                    await updateDoc(userRef, { campaigns: currentCampaignsArray });
                    
                    showToast("Campaign updated successfully!", "success");
                    renderMyCampaigns(currentCampaignsArray); // Update local cache and re-render
                    userCampaigns = currentCampaignsArray; // Explicitly update global cache
                    closeEditCampaignModal();
                } else {
                    showToast("Original campaign not found. Update failed.", "error");
                }
            } else {
                showToast("User data not found. Update failed.", "error");
            }
        } catch (error) {
            console.error("Error updating campaign in Firestore:", error);
            showToast("Failed to update campaign. Please try again.", "error");
        } finally {
            if(saveCampaignChangesButtonEl) {
                saveCampaignChangesButtonEl.disabled = false;
                saveCampaignChangesButtonEl.textContent = "Save Changes";
            }
        }
    });
}


// Notification Banner Link (Email Verification)
if (resendVerificationEmailBtn) {
    resendVerificationEmailBtn.addEventListener('click', async () => {
        if (currentUser && !currentUser.emailVerified) {
            try {
                resendVerificationEmailBtn.disabled = true;
                resendVerificationEmailBtn.textContent = "Sending...";
                await sendEmailVerification(currentUser);
                showToast("Verification email sent! Please check your inbox (and spam folder).", "success");
            } catch (error) {
                console.error("Error resending verification email:", error);
                let errorMsg = "Failed to resend verification email.";
                if (error.code === 'auth/too-many-requests') {
                    errorMsg = "Too many requests. Please try again later.";
                }
                showToast(errorMsg, "error");
            } finally {
                resendVerificationEmailBtn.disabled = false;
                 resendVerificationEmailBtn.textContent = "resend the verification email";
            }
        } else if (currentUser && currentUser.emailVerified) {
            showToast("Your email is already verified.", "info");
            if (emailVerificationBannerEl) emailVerificationBannerEl.style.display = 'none';
        }
    });
}

// Notification Banner Link (Pending Submissions)
if (viewPendingVerificationsLinkEl) {
    viewPendingVerificationsLinkEl.addEventListener('click', (e) => {
        e.preventDefault();
        const myCampaignsTabButton = document.querySelector('.sidebar .menu button[data-tab="campaigns"]');
        if (myCampaignsTabButton) {
            myCampaignsTabButton.click();
            showToast("Switched to 'My Campaigns'. Find your campaign and click 'View Submissions'.", "info", 4000);
        } else {
            showToast("Could not navigate to My Campaigns tab.", "error");
        }
    });
}


// Global click listener to close "My Campaigns" action dropdowns
document.addEventListener('click', function(event) {
  if (campaignsListContainer && !event.target.closest('.campaign-actions')) {
    campaignsListContainer.querySelectorAll('.actions-dropdown')
      .forEach(dropdown => dropdown.style.display = 'none');
  }
});

// --- Auth State and Initial Load ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null; userCampaigns = [];
    if (walletBalanceCardEl) walletBalanceCardEl.textContent = "Wallet Balance: ₹-";
    if (campaignsRunningCardEl) campaignsRunningCardEl.textContent = "Total Campaigns: -";
    if (totalViewsCardEl) totalViewsCardEl.textContent = "Total Views Earned: -";
    if (pendingVerificationsBannerEl) pendingVerificationsBannerEl.style.display = 'none';
    if (emailVerificationBannerEl) emailVerificationBannerEl.style.display = 'none'; 
    renderMyCampaigns([]);
    if (earnCampaignsListContainer) earnCampaignsListContainer.innerHTML = '<p data-no-campaigns-message="true">Please log in to see available campaigns.</p>';
    const profileInfo = document.getElementById("profileInfo");
    if (profileInfo) profileInfo.innerHTML = "<p>Please log in to view your profile.</p>";
    setTimeout(() => { window.location.href = "index.html"; }, 300);
    return;
  }
  currentUser = user;
  await loadUserDashboardData(user.uid);
  const activeTabButton = document.querySelector('.sidebar .menu button.active');
  if (activeTabButton && activeTabButton.dataset.tab === 'earn') {
      await loadAllCampaignsForEarning();
  }
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    newLogoutBtn.addEventListener('click', async () => {
      try { showToast("Logging out...", "info"); await signOut(auth); }
      catch (error) { console.error("Error signing out:", error); showToast("Error during sign out.", "error"); }
    });
  }
});

// --- Campaign Form Submission (Create New) ---
if (campaignForm) {
  campaignForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors();
    if (!currentUser) { showToast("You must be logged in to create a campaign.", "error"); return; }
    const urlInput = campaignForm.querySelector("input[name='url']");
    const viewsInput = campaignForm.querySelector("input[name='views']");
    const descInput = campaignForm.querySelector("textarea[name='desc']");
    const submitButton = campaignForm.querySelector("button[type='submit']");
    const url = urlInput.value.trim(), viewsStr = viewsInput.value.trim(), desc = descInput.value.trim();
    let isValid = true;
    if (!url) { if(urlErrorEl) urlErrorEl.textContent = "URL is required."; isValid = false; }
    else { try { new URL(url); } catch (_) { if(urlErrorEl) urlErrorEl.textContent = "Please enter a valid URL format (e.g., http://example.com/your-link)."; isValid = false;}}
    let views;
    if (!viewsStr) { if(viewsErrorEl) viewsErrorEl.textContent = "Target views required."; isValid = false; }
    else { views = parseInt(viewsStr); if (isNaN(views) || views <= 0) { if(viewsErrorEl) viewsErrorEl.textContent = "Views must be a positive whole number."; isValid = false; }}
    if (!desc) { if(descErrorEl) descErrorEl.textContent = "Brief description is required."; isValid = false; }
    else if (desc.length < 10 || desc.length > 200) { if(descErrorEl) descErrorEl.textContent = "Description must be between 10 and 200 characters."; isValid = false; }
    if (!isValid) { showToast("Please correct the errors in the form.", "error"); return; }
    const campaignId = `camp_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCampaign = { id: campaignId, url, views, desc, createdAt: new Date().toISOString(), status: "pending_review", currentViews: 0 };
    submitButton.disabled = true; submitButton.textContent = "Submitting...";
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { campaigns: arrayUnion(newCampaign) });
      userCampaigns.push(newCampaign); renderMyCampaigns(userCampaigns); 
      if (campaignsRunningCardEl) campaignsRunningCardEl.textContent = `Total Campaigns: ${userCampaigns.length}`;
      campaignForm.reset(); clearFormErrors();
      showToast("Campaign submitted! Public listing updates via backend if eligible.", "success");
      if(currentUser) await loadUserDashboardData(currentUser.uid); 
    } catch (err) { console.error("Error submitting campaign:", err); showToast("Failed to submit campaign.", "error");
    } finally { submitButton.disabled = false; submitButton.textContent = "Submit Campaign"; }
  });
}

// --- Placeholder Functions & Global Error Handler ---
window.addFunds = function() { showToast("Add Funds: Functionality not yet implemented.", "info"); }
window.withdrawFunds = function() { showToast("Withdraw Funds: Functionality not yet implemented.", "info"); }
window.forceLoad = async () => {
  if (!currentUser) { showToast("Not logged in.", "error"); return; }
  showToast("Reloading your campaigns...", "info");
  await loadUserDashboardData(currentUser.uid);
  showToast("Campaigns reloaded!", "success");
};
window.addEventListener('unhandledrejection', event => { console.error('Unhandled Promise Rejection:', event.reason); showToast(`Unexpected error: ${event.reason.message || event.reason}`, 'error'); });

// --- Tab Switching Logic ---
const tabs = document.querySelectorAll('.sidebar .menu button[data-tab]');
const sections = document.querySelectorAll('.main-content .tab-section');

tabs.forEach(tab => {
  tab.addEventListener('click', async () => {
    tabs.forEach(btn => btn.classList.remove('active'));
    sections.forEach(sec => sec.classList.remove('active'));
    tab.classList.add('active');
    const activeSectionId = tab.dataset.tab;
    const activeSection = document.getElementById(activeSectionId);
    if (activeSection) activeSection.classList.add('active');

    if (activeSectionId === 'earn') {
      if (currentUser) {
        await loadAllCampaignsForEarning();
      } else {
        if (earnCampaignsListContainer) earnCampaignsListContainer.innerHTML = '<p data-no-campaigns-message="true">Please log in to see available campaigns.</p>';
      }
    } else if (activeSectionId === 'campaigns' || activeSectionId === 'overview') {
        if(currentUser) {
            await loadUserDashboardData(currentUser.uid);
        }
    }
  });
});

// Initial icon rendering
if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}
