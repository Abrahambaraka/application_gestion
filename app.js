let employees = [
    {
        id: 1,
        name: "Marie Dupont",
        position: "Développeuse Frontend",
        department: "IT",
        seniority: 3,
        status: "Présent"
    },
    {
        id: 2,
        name: "Pierre Martin",
        position: "Responsable RH",
        department: "Ressources Humaines",
        seniority: 5,
        status: "Absent"
    },
    {
        id: 3,
        name: "Sophie Lambert",
        position: "Comptable",
        department: "Finance",
        seniority: 2,
        status: "Présent"
    },
    {
        id: 4,
        name: "Thomas Bernard",
        position: "Chef de Projet",
        department: "IT",
        seniority: 4,
        status: "Présent"
    },
    {
        id: 5,
        name: "Julie Petit",
        position: "Responsable Marketing",
        department: "Marketing",
        seniority: 6,
        status: "En congé"
    }
];

// Données des demandes de congé
let leaveRequests = [
    {
        id: 1,
        employee: "Pierre Martin",
        type: "Congé annuel",
        start: "15/07/2023",
        end: "30/07/2023",
        status: "En attente"
    },
    {
        id: 2,
        employee: "Sophie Lambert",
        type: "Congé maladie",
        start: "10/07/2023",
        end: "12/07/2023",
        status: "Approuvé"
    },
    {
        id: 3,
        employee: "Thomas Bernard",
        type: "Congé sans solde",
        start: "20/07/2023",
        end: "25/07/2023",
        status: "En attente"
    }
];

// Références aux éléments du DOM
const employeeTableBody = document.getElementById('employee-table-body');
const leaveRequestsTableBody = document.getElementById('leave-requests-table-body');
const activeEmployeesStat = document.getElementById('active-employees-stat');
const presentEmployeesStat = document.getElementById('present-employees-stat');
const leaveRequestsStat = document.getElementById('leave-requests-stat');
const payrollStat = document.getElementById('payroll-stat');
const departmentFilter = document.getElementById('department-filter');
const searchInput = document.getElementById('search-input');
const newEmployeeBtn = document.getElementById('new-employee-btn');

/**
 * Fonction pour rendre le tableau des employés.
 * @param {Array<Object>} filteredEmployees - Le tableau d'employés à afficher.
 */
function renderEmployees(filteredEmployees) {
    employeeTableBody.innerHTML = '';
    filteredEmployees.forEach(employee => {
        const row = document.createElement('tr');
        let statusBadgeClass = '';
        if (employee.status === 'Présent') {
            statusBadgeClass = 'status-present';
        } else if (employee.status === 'Absent' || employee.status === 'En congé') {
            statusBadgeClass = 'status-absent';
        }
        
        row.innerHTML = `
            <td>${employee.name}</td>
            <td>${employee.position}</td>
            <td>${employee.department}</td>
            <td>${employee.seniority} ans</td>
            <td><span class="status-badge ${statusBadgeClass}">${employee.status}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="viewEmployee(${employee.id})"><i class="fas fa-eye"></i></button>
                <button class="btn btn-warning btn-sm" onclick="editEmployee(${employee.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${employee.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        employeeTableBody.appendChild(row);
    });
}

/**
 * Fonction pour rendre le tableau des demandes de congé.
 */
function renderLeaveRequests() {
    leaveRequestsTableBody.innerHTML = '';
    leaveRequests.forEach(request => {
        const row = document.createElement('tr');
        let statusBadgeClass = '';
        if (request.status === 'En attente') {
            statusBadgeClass = 'status-pending';
        } else if (request.status === 'Approuvé') {
            statusBadgeClass = 'status-approved';
        }
        
        row.innerHTML = `
            <td>${request.employee}</td>
            <td>${request.type}</td>
            <td>${request.start}</td>
            <td>${request.end}</td>
            <td><span class="status-badge ${statusBadgeClass}">${request.status}</span></td>
            <td>
                ${request.status === 'En attente' ? `
                    <button class="btn btn-success btn-sm" onclick="approveLeave(${request.id})"><i class="fas fa-check"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="rejectLeave(${request.id})"><i class="fas fa-times"></i></button>
                ` : `
                    <button class="btn btn-primary btn-sm" onclick="viewLeave(${request.id})"><i class="fas fa-eye"></i></button>
                `}
            </td>
        `;
        leaveRequestsTableBody.appendChild(row);
    });
}

/**
 * Fonction pour mettre à jour les statistiques du tableau de bord.
 */
function updateStats() {
    const activeCount = employees.length;
    const presentCount = employees.filter(e => e.status === 'Présent').length;
    const pendingRequestsCount = leaveRequests.filter(r => r.status === 'En attente').length;
    const totalPayroll = Math.floor(Math.random() * (200000 - 100000 + 1)) + 100000; // Exemple de calcul aléatoire
    
    activeEmployeesStat.textContent = activeCount;
    presentEmployeesStat.textContent = presentCount;
    leaveRequestsStat.textContent = pendingRequestsCount;
    payrollStat.textContent = `€${totalPayroll.toLocaleString('fr-FR')}`;
}

/**
 * Fonction pour filtrer et rechercher les employés.
 */
function filterAndSearch() {
    const department = departmentFilter.value;
    const searchTerm = searchInput.value.toLowerCase();
    
    let filtered = employees;
    
    if (department !== 'Tous') {
        filtered = filtered.filter(e => e.department === department);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(e => e.name.toLowerCase().includes(searchTerm) || e.position.toLowerCase().includes(searchTerm));
    }
    
    renderEmployees(filtered);
}

// Fonctions pour les actions des boutons (simulées)
function newEmployee() {
    // Remplacer par une modal ou une redirection vers un formulaire
    alert("Fonctionnalité d'ajout d'employé en construction !");
}

function viewEmployee(id) {
    const employee = employees.find(e => e.id === id);
    // Remplacer par une modal d'affichage des détails
    alert(`Détails de l'employé : ${employee.name}, Poste: ${employee.position}`);
}

function editEmployee(id) {
    // Remplacer par une modal d'édition
    alert(`Édition de l'employé avec l'ID : ${id}`);
}

function deleteEmployee(id) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet employé ?")) {
        employees = employees.filter(e => e.id !== id);
        renderEmployees(employees);
        updateStats();
        alert("Employé supprimé !");
    }
}

function approveLeave(id) {
    const request = leaveRequests.find(r => r.id === id);
    if (request) {
        request.status = "Approuvé";
        renderLeaveRequests();
        updateStats();
        alert("Demande de congé approuvée !");
    }
}

function rejectLeave(id) {
    const request = leaveRequests.find(r => r.id === id);
    if (request) {
        request.status = "Rejeté";
        renderLeaveRequests();
        updateStats();
        alert("Demande de congé rejetée !");
    }
}

function viewLeave(id) {
    const request = leaveRequests.find(r => r.id === id);
    if (request) {
        alert(`Détails de la demande : ${request.employee}, du ${request.start} au ${request.end}`);
    }
}

// Écouteurs d'événements
document.addEventListener('DOMContentLoaded', () => {
    // Écouteurs pour les filtres et la recherche
    departmentFilter.addEventListener('change', filterAndSearch);
    searchInput.addEventListener('input', filterAndSearch);
    
    // Écouteur pour le bouton "Nouvel Employé"
    newEmployeeBtn.addEventListener('click', newEmployee);
    
    // Rendu initial de l'application
    renderEmployees(employees);
    renderLeaveRequests();
    updateStats();
});


