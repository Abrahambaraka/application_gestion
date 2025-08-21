import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

// Firebase application configuration (do not modify, it is provided by the environment)
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Constants for payroll logic
const SALARY_BASE_DAYS = 30;
const DEDUCTION_RATE = 0.05; // 5% deduction per day of unjustified absence

// Main application component
const App = () => {
    // State to manage application data
    const [employees, setEmployees] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [currentEmployee, setCurrentEmployee] = useState(null);
    const [activeSection, setActiveSection] = useState('list'); // 'list', 'form', 'details', 'report'
    const [activeTab, setActiveTab] = useState('prestations'); // 'prestations', 'presence', 'conges', 'paie'
    const [editAttendance, setEditAttendance] = useState(null); // For modifying an attendance record

    const [loading, setLoading] = useState(true);
    const [authReady, setAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);

    // State for forms
    const [formState, setFormState] = useState({
        nom: '',
        poste: '',
        département: '',
        dateEmbauche: '',
        salaire: ''
    });
    const [reviewState, setReviewState] = useState({
        note: 1,
        commentaires: ''
    });
    const [attendanceState, setAttendanceState] = useState({
        date: new Date().toISOString().split('T')[0],
        statut: 'present'
    });
    const [leaveState, setLeaveState] = useState({
        dateDebut: '',
        dateFin: '',
        raison: ''
    });

    //------------------------------------------
    // Initialization and authentication management
    //------------------------------------------
    useEffect(() => {
        const setupAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Initial authentication error:", error);
                await signInAnonymously(auth);
            }
            setLoading(false);
        };
        setupAuth();

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                setAuthReady(true);
            } else {
                setUserId(null);
                setAuthReady(false);
            }
        });
        
        return () => unsubscribeAuth();
    }, []);

    //------------------------------------------
    // Real-time data retrieval (Firestore)
    //------------------------------------------
    useEffect(() => {
        if (!authReady || !userId) return;

        // Fetch all data for all employees to support the report view
        const employeesCollectionPath = `artifacts/${appId}/public/data/employees`;
        const unsubscribeEmployees = onSnapshot(collection(db, employeesCollectionPath), (snapshot) => {
            const employeesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setEmployees(employeesData);
        }, (error) => {
            console.error("Error fetching employees:", error);
        });

        const reviewsCollectionPath = `artifacts/${appId}/public/data/prestation`;
        const unsubscribeReviews = onSnapshot(collection(db, reviewsCollectionPath), (snapshot) => {
            setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Error fetching reviews:", error);
        });

        const attendanceCollectionPath = `artifacts/${appId}/public/data/attendance`;
        const unsubscribeAttendance = onSnapshot(collection(db, attendanceCollectionPath), (snapshot) => {
            setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Error fetching attendance:", error);
        });

        const leaveRequestsCollectionPath = `artifacts/${appId}/public/data/leave_requests`;
        const unsubscribeLeaveRequests = onSnapshot(collection(db, leaveRequestsCollectionPath), (snapshot) => {
            setLeaveRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Error fetching leave requests:", error);
        });

        // Cleanup Firestore listeners
        return () => {
            unsubscribeEmployees();
            unsubscribeReviews();
            unsubscribeAttendance();
            unsubscribeLeaveRequests();
        };
    }, [authReady, userId]);

    //------------------------------------------
    // Data management functions
    //------------------------------------------
    const handleAddEmployee = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const employeesCollectionPath = `artifacts/${appId}/public/data/employees`;
            await addDoc(collection(db, employeesCollectionPath), {
                ...formState,
                salaire: parseFloat(formState.salaire)
            });
            resetForm();
            setActiveSection('list');
        } catch (error) {
            console.error("Error adding employee:", error);
        }
        setLoading(false);
    };

    const handleUpdateEmployee = async (e) => {
        e.preventDefault();
        if (!currentEmployee) return;
        setLoading(true);
        try {
            const employeesCollectionPath = `artifacts/${appId}/public/data/employees/${currentEmployee.id}`;
            await updateDoc(doc(db, employeesCollectionPath), {
                ...formState,
                salaire: parseFloat(formState.salaire)
            });
            resetForm();
            setActiveSection('list');
        } catch (error) {
            console.error("Error updating employee:", error);
        }
        setLoading(false);
    };

    const handleDeleteEmployee = async (employeeId) => {
        setLoading(true);
        try {
            const employeesCollectionPath = `artifacts/${appId}/public/data/employees/${employeeId}`;
            await deleteDoc(doc(db, employeesCollectionPath));
        } catch (error) {
            console.error("Error deleting employee:", error);
        }
        setLoading(false);
    };

    const handleAddReview = async (e) => {
        e.preventDefault();
        if (!currentEmployee) return;
        setLoading(true);
        try {
            const reviewsCollectionPath = `artifacts/${appId}/public/data/prestation`;
            await addDoc(collection(db, reviewsCollectionPath), {
                id_employe: currentEmployee.id,
                date_evaluation: new Date().toISOString().split('T')[0],
                note_globale: parseInt(reviewState.note),
                commentaires_manager: reviewState.commentaires
            });
            setReviewState({ note: 1, commentaires: '' });
        } catch (error) {
            console.error("Error adding review:", error);
        }
        setLoading(false);
    };

    const handleAddAttendance = async (e) => {
        e.preventDefault();
        if (!currentEmployee) return;
        setLoading(true);
        try {
            const attendanceCollectionPath = `artifacts/${appId}/public/data/attendance`;
            await addDoc(collection(db, attendanceCollectionPath), {
                id_employe: currentEmployee.id,
                date: attendanceState.date,
                statut: attendanceState.statut
            });
            setAttendanceState({ date: new Date().toISOString().split('T')[0], statut: 'present' });
        } catch (error) {
            console.error("Error adding attendance:", error);
        }
        setLoading(false);
    };

    const handleUpdateAttendance = async (e) => {
        e.preventDefault();
        if (!editAttendance) return;
        setLoading(true);
        try {
            const attendanceDocPath = `artifacts/${appId}/public/data/attendance/${editAttendance.id}`;
            await updateDoc(doc(db, attendanceDocPath), {
                statut: editAttendance.statut
            });
            setEditAttendance(null); // Close the edit form
        } catch (error) {
            console.error("Error updating attendance:", error);
        }
        setLoading(false);
    };

    const handleAddLeaveRequest = async (e) => {
        e.preventDefault();
        if (!currentEmployee) return;
        setLoading(true);
        try {
            const leaveRequestsCollectionPath = `artifacts/${appId}/public/data/leave_requests`;
            await addDoc(collection(db, leaveRequestsCollectionPath), {
                id_employe: currentEmployee.id,
                dateDebut: leaveState.dateDebut,
                dateFin: leaveState.dateFin,
                raison: leaveState.raison,
                statut: 'En attente'
            });
            setLeaveState({ dateDebut: '', dateFin: '', raison: '' });
        } catch (error) {
            console.error("Error adding leave request:", error);
        }
        setLoading(false);
    };

    const handleApproveLeave = async (requestId) => {
        setLoading(true);
        try {
            const leaveDocPath = `artifacts/${appId}/public/data/leave_requests/${requestId}`;
            await updateDoc(doc(db, leaveDocPath), { statut: 'Approuvé' });
        } catch (error) {
            console.error("Error approving leave:", error);
        }
        setLoading(false);
    };

    const handleRejectLeave = async (requestId) => {
        setLoading(true);
        try {
            const leaveDocPath = `artifacts/${appId}/public/data/leave_requests/${requestId}`;
            await updateDoc(doc(db, leaveDocPath), { statut: 'Rejeté' });
        } catch (error) {
            console.error("Error rejecting leave:", error);
        }
        setLoading(false);
    };

    //------------------------------------------
    // Helper functions
    //------------------------------------------
    const resetForm = () => {
        setFormState({ nom: '', poste: '', département: '', dateEmbauche: '', salaire: '' });
        setCurrentEmployee(null);
    };

    const openEditForm = (employee) => {
        setFormState(employee);
        setCurrentEmployee(employee);
        setActiveSection('form');
    };

    const openDetails = (employee) => {
        setCurrentEmployee(employee);
        setActiveSection('details');
        setActiveTab('prestations');
    };

    const calculatePayroll = (employee, employeeAttendance) => {
        if (!employee || !employee.salaire) return { salaireInitial: 0, deductions: 0, salaireFinal: 0, absences: 0 };
        
        const salaireInitial = parseFloat(employee.salaire);
        const absencesNonJustifiees = employeeAttendance.filter(att => att.statut === 'absent').length;
        const deduction = absencesNonJustifiees * DEDUCTION_RATE * salaireInitial;
        const salaireFinal = salaireInitial - deduction;

        return {
            salaireInitial: salaireInitial.toFixed(2),
            deductions: deduction.toFixed(2),
            salaireFinal: salaireFinal.toFixed(2),
            absences: absencesNonJustifiees
        };
    };
    
    // Function to calculate years of service
    const calculateYearsOfService = (hireDateStr) => {
        if (!hireDateStr) return 'N/A';
        const today = new Date();
        const hireDate = new Date(hireDateStr);
        let years = today.getFullYear() - hireDate.getFullYear();
        const months = today.getMonth() - hireDate.getMonth();
        if (months < 0 || (months === 0 && today.getDate() < hireDate.getDate())) {
            years--;
        }
        return years;
    };

    const payrollData = currentEmployee ? calculatePayroll(currentEmployee, attendance) : {};

    // Handle print action
    const handlePrint = () => {
        window.print();
    };

    if (loading || !authReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 p-8">
                <div className="text-xl font-semibold text-gray-700">Chargement de l'application...</div>
            </div>
        );
    }
    
    return (
        <div className="bg-gray-100 min-h-screen font-sans text-gray-800 p-4 sm:p-8 rounded-lg">
            <div className="max-w-7xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-2xl">
                {/* Application Header */}
                <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-700 mb-2 text-center">Gestion des Employés & Prestations</h1>
                    <p className="text-sm text-gray-500 text-center">Votre ID utilisateur pour la collaboration : <span className="font-mono bg-gray-200 px-2 py-1 rounded text-xs">{userId}</span></p>
                </header>

                {/* Button to add a new employee and generate report */}
                {activeSection === 'list' && (
                    <div className="flex justify-end space-x-4 mb-6">
                        <button
                            onClick={() => setActiveSection('report')}
                            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                            Générer le rapport journalier
                        </button>
                        <button
                            onClick={() => {
                                setActiveSection('form');
                                resetForm();
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            Ajouter un employé
                        </button>
                    </div>
                )}

                {/* Conditional display of views */}
                {activeSection === 'list' && (
                    <div className="overflow-x-auto">
                        <h2 className="text-2xl font-semibold text-blue-600 mb-4">Liste des employés</h2>
                        {employees.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">Aucun employé enregistré. Ajoutez-en un pour commencer !</p>
                        ) : (
                            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                                <thead className="bg-blue-100">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Nom</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Poste</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Département</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Salaire</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Ancienneté</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => (
                                        <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm text-gray-700 font-medium">{emp.nom}</td>
                                            <td className="py-3 px-4 text-sm text-gray-700">{emp.poste}</td>
                                            <td className="py-3 px-4 text-sm text-gray-700">{emp.département}</td>
                                            <td className="py-3 px-4 text-sm text-gray-700">{emp.salaire ? `${parseFloat(emp.salaire).toLocaleString()} €` : 'N/A'}</td>
                                            <td className="py-3 px-4 text-sm text-gray-700">{emp.dateEmbauche ? `${calculateYearsOfService(emp.dateEmbauche)} an(s)` : 'N/A'}</td>
                                            <td className="py-3 px-4 text-sm text-gray-700 flex space-x-2">
                                                <button onClick={() => openEditForm(emp)} className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-semibold hover:bg-yellow-600 transition">
                                                    Modifier
                                                </button>
                                                <button onClick={() => openDetails(emp)} className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold hover:bg-green-600 transition">
                                                    Détails
                                                </button>
                                                <button onClick={() => handleDeleteEmployee(emp.id)} className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold hover:bg-red-600 transition">
                                                    Supprimer
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
                
                {/* Employee add/edit form */}
                {activeSection === 'form' && (
                    <div className="p-6 bg-white rounded-lg shadow-inner">
                        <h2 className="text-2xl font-semibold text-blue-600 mb-4">{currentEmployee ? 'Modifier l\'employé' : 'Ajouter un nouvel employé'}</h2>
                        <form onSubmit={currentEmployee ? handleUpdateEmployee : handleAddEmployee} className="space-y-4">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Nom & Prénom</label>
                                <input
                                    type="text"
                                    value={formState.nom}
                                    onChange={(e) => setFormState({ ...formState, nom: e.target.value })}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Poste</label>
                                <input
                                    type="text"
                                    value={formState.poste}
                                    onChange={(e) => setFormState({ ...formState, poste: e.target.value })}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Département</label>
                                <input
                                    type="text"
                                    value={formState.département}
                                    onChange={(e) => setFormState({ ...formState, département: e.target.value })}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Date d'embauche</label>
                                <input
                                    type="date"
                                    value={formState.dateEmbauche}
                                    onChange={(e) => setFormState({ ...formState, dateEmbauche: e.target.value })}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Salaire mensuel</label>
                                <input
                                    type="number"
                                    value={formState.salaire}
                                    onChange={(e) => setFormState({ ...formState, salaire: e.target.value })}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveSection('list');
                                        resetForm();
                                    }}
                                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
                                >
                                    {currentEmployee ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                
                {/* Employee details section (reviews, attendance, etc.) */}
                {activeSection === 'details' && currentEmployee && (
                    <div className="p-6 bg-white rounded-lg shadow-inner">
                        <button
                            onClick={() => setActiveSection('list')}
                            className="text-blue-500 hover:text-blue-700 font-semibold mb-4 transition"
                        >
                            &larr; Retour à la liste
                        </button>
                        <h2 className="text-2xl font-semibold text-blue-600 mb-2">Détails de {currentEmployee.nom}</h2>
                        <p className="text-sm text-gray-500 mb-4">Ancienneté: <span className="font-semibold text-gray-700">{calculateYearsOfService(currentEmployee.dateEmbauche)} an(s)</span></p>

                        {/* Navigation tabs */}
                        <div className="flex space-x-4 border-b-2 border-gray-200 mb-6">
                            <button
                                onClick={() => setActiveTab('prestations')}
                                className={`px-4 py-2 font-semibold transition ${activeTab === 'prestations' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Prestations
                            </button>
                            <button
                                onClick={() => setActiveTab('presence')}
                                className={`px-4 py-2 font-semibold transition ${activeTab === 'presence' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Présence
                            </button>
                            <button
                                onClick={() => setActiveTab('conges')}
                                className={`px-4 py-2 font-semibold transition ${activeTab === 'conges' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Congés
                            </button>
                            <button
                                onClick={() => setActiveTab('paie')}
                                className={`px-4 py-2 font-semibold transition ${activeTab === 'paie' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Paie
                            </button>
                        </div>

                        {/* Tab Content */}
                        {/* Performance Section */}
                        {activeTab === 'prestations' && (
                            <>
                                <div className="mb-6 border-b pb-4">
                                    <h3 className="text-xl font-medium text-gray-700 mb-2">Ajouter une nouvelle prestation</h3>
                                    <form onSubmit={handleAddReview} className="space-y-4">
                                        <div>
                                            <label className="block text-gray-700 text-sm font-bold mb-2">Note (1-5)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="5"
                                                value={reviewState.note}
                                                onChange={(e) => setReviewState({ ...reviewState, note: e.target.value })}
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-700 text-sm font-bold mb-2">Commentaires du manager</label>
                                            <textarea
                                                value={reviewState.commentaires}
                                                onChange={(e) => setReviewState({ ...reviewState, commentaires: e.target.value })}
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32"
                                                required
                                            ></textarea>
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition"
                                        >
                                            Enregistrer la prestation
                                        </button>
                                    </form>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xl font-medium text-gray-700">Historique des prestations</h3>
                                    {reviews.filter(r => r.id_employe === currentEmployee.id).length === 0 ? (
                                        <p className="text-gray-500">Aucune prestation enregistrée pour cet employé.</p>
                                    ) : (
                                        reviews.filter(r => r.id_employe === currentEmployee.id).map(review => (
                                            <div key={review.id} className="bg-gray-100 p-4 rounded-lg shadow">
                                                <p className="font-semibold text-gray-800">Date: <span className="font-normal">{review.date_evaluation}</span></p>
                                                <p className="font-semibold text-gray-800">Note: <span className="font-normal">{review.note_globale}/5</span></p>
                                                <p className="font-semibold text-gray-800 mt-2">Commentaires:</p>
                                                <p className="text-gray-600">{review.commentaires_manager}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}

                        {/* Attendance Section */}
                        {activeTab === 'presence' && (
                            <>
                                <div className="mb-6 border-b pb-4">
                                    <h3 className="text-xl font-medium text-gray-700 mb-2">Enregistrer la présence</h3>
                                    <form onSubmit={handleAddAttendance} className="space-y-4">
                                        <div>
                                            <label className="block text-gray-700 text-sm font-bold mb-2">Date</label>
                                            <input
                                                type="date"
                                                value={attendanceState.date}
                                                onChange={(e) => setAttendanceState({ ...attendanceState, date: e.target.value })}
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-700 text-sm font-bold mb-2">Statut</label>
                                            <select
                                                value={attendanceState.statut}
                                                onChange={(e) => setAttendanceState({ ...attendanceState, statut: e.target.value })}
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                            >
                                                <option value="present">Présent</option>
                                                <option value="absent">Absent (non justifié)</option>
                                                <option value="justified_absence">Absence justifiée</option>
                                            </select>
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition"
                                        >
                                            Enregistrer
                                        </button>
                                    </form>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xl font-medium text-gray-700">Historique des présences</h3>
                                    {attendance.filter(a => a.id_employe === currentEmployee.id).length === 0 ? (
                                        <p className="text-gray-500">Aucune présence enregistrée.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                                                <thead className="bg-purple-100">
                                                    <tr>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Date</th>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Statut</th>
                                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {attendance.filter(a => a.id_employe === currentEmployee.id).map(att => (
                                                        <tr key={att.id} className="border-b last:border-0 hover:bg-gray-50">
                                                            <td className="py-3 px-4 text-sm text-gray-700 font-medium">{att.date}</td>
                                                            <td className="py-3 px-4 text-sm text-gray-700">{att.statut === 'present' ? 'Présent' : att.statut === 'absent' ? 'Absent (Non justifié)' : 'Absence justifiée'}</td>
                                                            <td className="py-3 px-4 text-sm text-gray-700">
                                                                <button onClick={() => setEditAttendance(att)} className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-semibold hover:bg-yellow-600 transition">
                                                                    Modifier
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Attendance modification form */}
                                {editAttendance && (
                                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
                                        <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-sm">
                                            <h3 className="text-xl font-semibold text-blue-600 mb-4">Modifier la présence</h3>
                                            <form onSubmit={handleUpdateAttendance} className="space-y-4">
                                                <div>
                                                    <label className="block text-gray-700 text-sm font-bold mb-2">Date</label>
                                                    <input
                                                        type="date"
                                                        value={editAttendance.date}
                                                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100 cursor-not-allowed"
                                                        disabled
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-700 text-sm font-bold mb-2">Statut</label>
                                                    <select
                                                        value={editAttendance.statut}
                                                        onChange={(e) => setEditAttendance({ ...editAttendance, statut: e.target.value })}
                                                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                                    >
                                                        <option value="present">Présent</option>
                                                        <option value="absent">Absent (non justifié)</option>
                                                        <option value="justified_absence">Absence justifiée</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-end space-x-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditAttendance(null)}
                                                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition"
                                                    >
                                                        Annuler
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
                                                    >
                                                        Mettre à jour
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        
                        {/* Leave Section */}
                        {activeTab === 'conges' && (
                            <>
                                <div className="mb-6 border-b pb-4">
                                    <h3 className="text-xl font-medium text-gray-700 mb-2">Demander un congé</h3>
                                    <form onSubmit={handleAddLeaveRequest} className="space-y-4">
                                        <div>
                                            <label className="block text-gray-700 text-sm font-bold mb-2">Date de début</label>
                                            <input
                                                type="date"
                                                value={leaveState.dateDebut}
                                                onChange={(e) => setLeaveState({ ...leaveState, dateDebut: e.target.value })}
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-700 text-sm font-bold mb-2">Date de fin</label>
                                            <input
                                                type="date"
                                                value={leaveState.dateFin}
                                                onChange={(e) => setLeaveState({ ...leaveState, dateFin: e.target.value })}
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-700 text-sm font-bold mb-2">Raison</label>
                                            <textarea
                                                value={leaveState.raison}
                                                onChange={(e) => setLeaveState({ ...leaveState, raison: e.target.value })}
                                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24"
                                                required
                                            ></textarea>
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition"
                                        >
                                            Envoyer la demande
                                        </button>
                                    </form>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xl font-medium text-gray-700">Demandes de congés</h3>
                                    {leaveRequests.filter(l => l.id_employe === currentEmployee.id).length === 0 ? (
                                        <p className="text-gray-500">Aucune demande de congé enregistrée.</p>
                                    ) : (
                                        leaveRequests.filter(l => l.id_employe === currentEmployee.id).map(req => (
                                            <div key={req.id} className="bg-gray-100 p-4 rounded-lg shadow flex justify-between items-center">
                                                <div>
                                                    <p className="font-semibold text-gray-800">Du <span className="font-normal">{req.dateDebut}</span> au <span className="font-normal">{req.dateFin}</span></p>
                                                    <p className="text-sm text-gray-600">Raison: {req.raison}</p>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${req.statut === 'Approuvé' ? 'bg-green-200 text-green-800' : req.statut === 'Rejeté' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                        {req.statut}
                                                    </span>
                                                    {req.statut === 'En attente' && (
                                                        <>
                                                            <button onClick={() => handleApproveLeave(req.id)} className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold hover:bg-green-600 transition">
                                                                Approuver
                                                            </button>
                                                            <button onClick={() => handleRejectLeave(req.id)} className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold hover:bg-red-600 transition">
                                                                Rejeter
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}

                        {/* Payroll Section */}
                        {activeTab === 'paie' && (
                            <div className="p-4 bg-white rounded-lg shadow-inner">
                                <h3 className="text-xl font-medium text-gray-700 mb-4">Calcul de la paie</h3>
                                <div className="space-y-4">
                                    <div className="bg-blue-100 p-4 rounded-lg shadow-md">
                                        <p className="text-sm text-blue-800 font-semibold">Salaire de base (pour 30 jours ouvrables)</p>
                                        <p className="text-2xl font-bold text-blue-900">{payrollData.salaireInitial} €</p>
                                    </div>
                                    <div className="bg-red-100 p-4 rounded-lg shadow-md">
                                        <p className="text-sm text-red-800 font-semibold">Absences non justifiées ce mois-ci</p>
                                        <p className="text-2xl font-bold text-red-900">{payrollData.absences} jour(s)</p>
                                    </div>
                                    <div className="bg-red-100 p-4 rounded-lg shadow-md">
                                        <p className="text-sm text-red-800 font-semibold">Déductions totales (5% par jour d'absence)</p>
                                        <p className="text-2xl font-bold text-red-900">- {payrollData.deductions} €</p>
                                    </div>
                                    <div className="bg-green-100 p-4 rounded-lg shadow-md">
                                        <p className="text-sm text-green-800 font-semibold">Salaire net estimé</p>
                                        <p className="text-2xl font-bold text-green-900">{payrollData.salaireFinal} €</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Daily Report Section */}
                {activeSection === 'report' && (
                    <div className="p-6 bg-white rounded-lg shadow-inner">
                        <div className="flex justify-between items-center mb-4">
                            <button
                                onClick={() => setActiveSection('list')}
                                className="text-blue-500 hover:text-blue-700 font-semibold transition print:hidden"
                            >
                                &larr; Retour à la liste
                            </button>
                            {/* Bouton pour imprimer le rapport. La classe 'print:hidden' le cache lors de l'impression. */}
                            <button
                                onClick={handlePrint}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition print:hidden"
                            >
                                Imprimer le rapport
                            </button>
                        </div>
                        
                        <h2 className="text-2xl font-semibold text-blue-600 mb-4">Rapport Journalier</h2>
                        <p className="text-sm text-gray-500 mb-6">Date du rapport : <span className="font-semibold">{new Date().toLocaleDateString()}</span></p>

                        {employees.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">Aucune donnée d'employé à afficher.</p>
                        ) : (
                            employees.map(employee => {
                                // Filter data for the current employee within the loop
                                const employeeReviews = reviews.filter(r => r.id_employe === employee.id);
                                const employeeAttendance = attendance.filter(a => a.id_employe === employee.id);
                                const employeeLeaveRequests = leaveRequests.filter(l => l.id_employe === employee.id);
                                const employeePayroll = calculatePayroll(employee, employeeAttendance);

                                return (
                                    <div key={employee.id} className="mb-8 p-6 border-2 border-gray-200 rounded-xl shadow-md">
                                        <h3 className="text-xl font-bold text-gray-800 mb-2">{employee.nom}</h3>
                                        <p className="text-gray-600 mb-4">Poste : <span className="font-semibold">{employee.poste}</span></p>
                                        
                                        {/* Attendance Summary */}
                                        <div className="mb-4">
                                            <h4 className="text-lg font-semibold text-gray-700 mb-2">Présence & Congés</h4>
                                            <p className="text-gray-600">Statut actuel : <span className="font-semibold">{employeeAttendance.length > 0 ? (employeeAttendance[employeeAttendance.length-1].statut === 'present' ? 'Présent' : 'Absent') : 'Non enregistré'}</span></p>
                                            <p className="text-gray-600">Absences non justifiées : <span className="font-semibold">{employeePayroll.absences} jour(s)</span></p>
                                            
                                            {employeeLeaveRequests.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="font-semibold text-sm text-gray-700">Demandes de congés :</p>
                                                    <ul className="list-disc list-inside text-sm text-gray-600">
                                                        {employeeLeaveRequests.map(req => (
                                                            <li key={req.id}>
                                                                Du {req.dateDebut} au {req.dateFin} - Statut : <span className={`font-semibold ${req.statut === 'Approuvé' ? 'text-green-600' : req.statut === 'Rejeté' ? 'text-red-600' : 'text-yellow-600'}`}>{req.statut}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Payroll Summary */}
                                        <div className="mb-4">
                                            <h4 className="text-lg font-semibold text-gray-700 mb-2">Synthèse de la paie</h4>
                                            <p className="text-gray-600">Salaire de base : <span className="font-semibold">{employee.salaire ? `${parseFloat(employee.salaire).toLocaleString()} €` : 'N/A'}</span></p>
                                            <p className="text-gray-600">Déductions : <span className="font-semibold">- {employeePayroll.deductions} €</span></p>
                                            <p className="text-gray-600">Salaire estimé : <span className="font-bold text-green-700">{employeePayroll.salaireFinal} €</span></p>
                                        </div>

                                        {/* Performance Summary */}
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-700 mb-2">Historique des prestations</h4>
                                            {employeeReviews.length === 0 ? (
                                                <p className="text-gray-500 text-sm">Aucune prestation enregistrée.</p>
                                            ) : (
                                                <ul className="list-disc list-inside text-sm text-gray-600">
                                                    {employeeReviews.map(review => (
                                                        <li key={review.id}>
                                                            Date: {review.date_evaluation}, Note: <span className="font-semibold">{review.note_globale}/5</span> - "{review.commentaires_manager}"
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
