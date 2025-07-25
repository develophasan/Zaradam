import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const adminLogin = async (username, password) => {
    const response = await axios.post(`${API}/auth/admin/login`, { username, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const register = async (username, email, password, name, privacyAgreement) => {
    const response = await axios.post(`${API}/auth/register`, {
      username, email, password, name, privacy_agreement: privacyAgreement
    });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, login, adminLogin, register, logout, loading,
      token, setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="dice-loader">
          <div className="dice-face">🎲</div>
        </div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/" />;
};

// Admin Route
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="dice-loader">
          <div className="dice-face">🎲</div>
        </div>
      </div>
    );
  }
  
  return user?.is_admin ? children : <Navigate to="/" />;
};

// API Helper
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };
  
  const response = await axios(endpoint, config);
  return response.data;
};

// Privacy Agreement Modal
const PrivacyModal = ({ isOpen, onAccept, onDecline }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-zinc-800">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-2xl font-bold text-white">Kişisel Verilerin İşlenmesi Sözleşmesi</h2>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-96 text-zinc-300 text-sm leading-relaxed">
          <h3 className="text-white font-bold mb-4">ZARVER - KİŞİSEL VERİLERİN İŞLENMESİ AYDINLATMA METNİ</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-white font-semibold mb-2">1. Veri Sorumlusu</h4>
              <p>Zarver Uygulaması, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla hareket etmektedir.</p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2">2. İşlenen Kişisel Veriler</h4>
              <p>• İsim, soyisim ve kullanıcı adı bilgileriniz<br/>
              • E-posta adresiniz<br/>
              • IP adresiniz ve kullanım logları<br/>
              • Uygulama içinde oluşturduğunuz karar metinleri<br/>
              • Mesajlaşma ve etkileşim verileri</p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2">3. İşleme Amaçları</h4>
              <p>• Hizmet sunumunun sağlanması<br/>
              • Kullanıcı deneyiminin iyileştirilmesi<br/>
              • Yasal yükümlülüklerinin yerine getirilmesi<br/>
              • Güvenlik tedbirlerinin alınması</p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2">4. Veri Aktarımı</h4>
              <p>Kişisel verileriniz, yasal zorunluluklar çerçevesinde yetkili kurum ve kuruluşlarla paylaşılabilir. Bu durumda kullanıcılar bilgilendirilecektir.</p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2">5. Saklama Süresi</h4>
              <p>Verileriniz, işleme amacının gerektirdiği süre boyunca ve yasal saklama yükümlülükleri çerçevesinde saklanır.</p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2">6. Haklarınız</h4>
              <p>KVKK kapsamında, verilerinizin işlenip işlenmediğini öğrenme, düzeltme, silme talep etme haklarınız bulunmaktadır.</p>
            </div>
            
            <div className="bg-red-900 border border-red-700 p-4 rounded-xl">
              <h4 className="text-red-300 font-semibold mb-2">⚠️ ÖNEMLİ UYARI</h4>
              <p className="text-red-200">Bu sözleşmeyi kabul etmekle, yukarıda belirtilen amaçlarla kişisel verilerinizin işlenmesine ve yasal zorunluluklar çerçevesinde paylaşılmasına onay vermiş olursunuz.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-zinc-800 flex space-x-4">
          <button
            onClick={onDecline}
            className="flex-1 bg-zinc-700 text-white py-3 rounded-xl font-bold hover:bg-zinc-600 transition-colors border border-zinc-600"
          >
            REDDET
          </button>
          <button
            onClick={onAccept}
            className="flex-1 bg-white text-black py-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
          >
            KABUL EDİYORUM
          </button>
        </div>
      </div>
    </div>
  );
};

// Onboarding/Login Sayfası
const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    if (user?.is_admin) {
      navigate('/admin');
    } else if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-2xl p-8 text-center border border-zinc-800">
        <div className="mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center text-4xl dice-shadow">
            ⚫
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">ZARVER</h1>
          <p className="text-zinc-400 text-lg">Kararsızlıklarını zar ile çöz</p>
        </div>
        
        <div className="space-y-6 mb-8">
          <div className="flex items-start space-x-4 text-left">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-zinc-700">
              🤖
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">AI Destekli Çözümler</h3>
              <p className="text-zinc-400">Kararsızlığını yaz, akıllı alternatifler al</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 text-left">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-zinc-700">
              🎲
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Zar ile Karar Ver</h3>
              <p className="text-zinc-400">Şansın seni nereye götürüyor?</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4 text-left">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-zinc-700">
              👥
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Sosyal Deneyim</h3>
              <p className="text-zinc-400">Arkadaşlarınla kararlarını paylaş</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-zinc-200 transition-all duration-200 shadow-lg"
          >
            GİRİŞ YAP
          </button>
          
          <button 
            onClick={() => navigate('/register')}
            className="w-full bg-zinc-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-zinc-700 transition-all duration-200 border border-zinc-700"
          >
            KAYIT OL
          </button>
          
          <button 
            onClick={() => navigate('/admin-login')}
            className="w-full bg-red-900 text-white py-2 rounded-xl font-bold text-sm hover:bg-red-800 transition-all duration-200 border border-red-700"
          >
            🔒 ADMİN GİRİŞİ
          </button>
        </div>
      </div>
    </div>
  );
};

// Admin Giriş Sayfası
const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { adminLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      await adminLogin(username, password);
      navigate('/admin');
    } catch (error) {
      setError(error.response?.data?.detail || "Admin giriş başarısız");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-zinc-800">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-900 rounded-xl mx-auto mb-4 flex items-center justify-center text-2xl border border-red-700">
            🔒
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Girişi</h1>
          <p className="text-zinc-400">Yönetici paneline erişim</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="text"
              placeholder="Kullanıcı Adı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-red-500 focus:outline-none"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-red-500 focus:outline-none"
              required
            />
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 p-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-800 transition-all duration-200 disabled:opacity-50 border border-red-700"
          >
            {loading ? "GİRİŞ YAPILIYOR..." : "ADMİN GİRİŞİ"}
          </button>
        </form>

        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 text-zinc-400 hover:text-white text-2xl"
        >
          ←
        </button>
      </div>
    </div>
  );
};

// Giriş Sayfası
const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      await login(email, password);
      navigate('/home');
    } catch (error) {
      setError(error.response?.data?.detail || "Giriş başarısız");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-zinc-800">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-xl mx-auto mb-4 flex items-center justify-center text-2xl dice-shadow">
            ⚫
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Giriş Yap</h1>
          <p className="text-zinc-400">Hesabına giriş yap</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="email"
              placeholder="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
              required
            />
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 p-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-zinc-200 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? "GİRİŞ YAPILIYOR..." : "GİRİŞ YAP"}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/register')}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            Hesabın yok mu? <span className="text-white font-semibold">Kayıt ol</span>
          </button>
        </div>

        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 text-zinc-400 hover:text-white text-2xl"
        >
          ←
        </button>
      </div>
    </div>
  );
};

// Kayıt Sayfası
const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!privacyAccepted) {
      setShowPrivacyModal(true);
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      await register(formData.username, formData.email, formData.password, formData.name, privacyAccepted);
      navigate('/home');
    } catch (error) {
      setError(error.response?.data?.detail || "Kayıt başarısız");
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePrivacyAccept = () => {
    setPrivacyAccepted(true);
    setShowPrivacyModal(false);
    // Form submit işlemini tetikle
    const form = document.getElementById('register-form');
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  };

  const handlePrivacyDecline = () => {
    setShowPrivacyModal(false);
    setPrivacyAccepted(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-zinc-800">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-xl mx-auto mb-4 flex items-center justify-center text-2xl dice-shadow">
            ⚫
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Kayıt Ol</h1>
          <p className="text-zinc-400">Yeni hesap oluştur</p>
        </div>

        <form id="register-form" onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Adın Soyadın"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
            required
          />
          
          <input
            type="text"
            name="username"
            placeholder="Kullanıcı Adı"
            value={formData.username}
            onChange={handleChange}
            className="w-full p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
            required
          />
          
          <input
            type="email"
            name="email"
            placeholder="E-posta"
            value={formData.email}
            onChange={handleChange}
            className="w-full p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
            required
          />
          
          <input
            type="password"
            name="password"
            placeholder="Şifre"
            value={formData.password}
            onChange={handleChange}
            className="w-full p-4 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
            required
          />

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 p-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="bg-zinc-800 border border-zinc-700 p-4 rounded-xl">
            <label className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 text-white bg-zinc-700 border-zinc-600 rounded focus:ring-white"
              />
              <span className="text-sm text-zinc-300">
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-white hover:underline font-semibold"
                >
                  Kişisel Verilerin İşlenmesi Sözleşmesi
                </button>
                'ni okudum ve kabul ediyorum.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-zinc-200 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? "KAYIT EDİLİYOR..." : "KAYIT OL"}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/login')}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            Zaten hesabın var mı? <span className="text-white font-semibold">Giriş yap</span>
          </button>
        </div>

        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 text-zinc-400 hover:text-white text-2xl"
        >
          ←
        </button>
      </div>

      <PrivacyModal 
        isOpen={showPrivacyModal}
        onAccept={handlePrivacyAccept}
        onDecline={handlePrivacyDecline}
      />
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [dashboard, userList, logList] = await Promise.all([
        apiCall(`${API}/admin/dashboard`),
        apiCall(`${API}/admin/users?limit=100`),
        apiCall(`${API}/admin/logs?limit=50`)
      ]);
      
      setDashboardData(dashboard);
      setUsers(userList);
      setLogs(logList);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    }
    setLoading(false);
  };

  const suspendUser = async (userId, reason, days) => {
    try {
      await apiCall(`${API}/admin/users/${userId}/suspend`, {
        method: 'POST',
        data: { user_id: userId, reason, duration_days: parseInt(days) }
      });
      fetchDashboardData(); // Refresh data
      alert('Kullanıcı başarıyla askıya alındı');
    } catch (error) {
      alert('Askıya alma işlemi başarısız: ' + error.response?.data?.detail);
    }
  };

  const unsuspendUser = async (userId) => {
    try {
      await apiCall(`${API}/admin/users/${userId}/unsuspend`, {
        method: 'POST'
      });
      fetchDashboardData(); // Refresh data
      alert('Kullanıcı askısı başarıyla kaldırıldı');
    } catch (error) {
      alert('Askı kaldırma işlemi başarısız: ' + error.response?.data?.detail);
    }
  };

  const exportUserData = async () => {
    if (!confirm('Kullanıcı verilerini export etmek istediğinizden emin misiniz? Bu işlem loglanacaktır.')) {
      return;
    }
    
    try {
      const data = await apiCall(`${API}/admin/export/users`);
      
      // JSON dosyasını indir
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zarver_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Veri export işlemi tamamlandı ve loglandı');
      fetchDashboardData(); // Refresh logs
    } catch (error) {
      alert('Export işlemi başarısız: ' + error.response?.data?.detail);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-900 rounded-lg flex items-center justify-center text-lg border border-red-700">
              🔒
            </div>
            <h1 className="text-2xl font-bold text-white">ZARVER ADMİN</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-zinc-400">Admin Panel</span>
            <button
              onClick={logout}
              className="bg-red-900 text-white px-4 py-2 rounded-lg hover:bg-red-800 transition-colors border border-red-700"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          {[
            { key: 'dashboard', label: '📊 Dashboard', },
            { key: 'users', label: '👥 Kullanıcılar' },
            { key: 'logs', label: '📋 Loglar' },
            { key: 'export', label: '📤 Export' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <div className="text-3xl font-bold text-white mb-2">{dashboardData.stats.total_users}</div>
              <div className="text-zinc-400">Toplam Kullanıcı</div>
            </div>
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <div className="text-3xl font-bold text-green-400 mb-2">{dashboardData.stats.active_users}</div>
              <div className="text-zinc-400">Aktif Kullanıcı</div>
            </div>
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <div className="text-3xl font-bold text-red-400 mb-2">{dashboardData.stats.suspended_users}</div>
              <div className="text-zinc-400">Askıya Alınmış</div>
            </div>
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <div className="text-3xl font-bold text-blue-400 mb-2">{dashboardData.stats.total_decisions}</div>
              <div className="text-zinc-400">Toplam Karar</div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Kullanıcı ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 p-3 bg-zinc-900 text-white rounded-xl border border-zinc-800 focus:border-white focus:outline-none"
              />
            </div>

            <div className="space-y-4">
              {filteredUsers.map(user => (
                <div key={user._id} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <img 
                        src={user.avatar} 
                        alt={user.name}
                        className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                      />
                      <div>
                        <h3 className="text-white font-bold">{user.name}</h3>
                        <p className="text-zinc-400">@{user.username} • {user.email}</p>
                        <p className="text-sm text-zinc-500">Kayıt: {user.created_at}</p>
                        {user.is_suspended && (
                          <p className="text-red-400 text-sm font-semibold">
                            ⚠️ ASKİYA ALINMIŞ: {user.suspension_reason}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {user.is_suspended ? (
                        <button
                          onClick={() => unsuspendUser(user._id)}
                          className="bg-green-900 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors border border-green-700"
                        >
                          Askıyı Kaldır
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const reason = prompt('Askıya alma sebebi:');
                            const days = prompt('Askı süresi (gün, 0=kalıcı):');
                            if (reason && days !== null) {
                              suspendUser(user._id, reason, days);
                            }
                          }}
                          className="bg-red-900 text-white px-4 py-2 rounded-lg hover:bg-red-800 transition-colors border border-red-700"
                        >
                          Askıya Al
                        </button>
                      )}
                      
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="bg-blue-900 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors border border-blue-700"
                      >
                        Detaylar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4">Admin İşlem Logları</h2>
            {logs.map(log => (
              <div key={log._id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold">{log.action}</span>
                  <span className="text-zinc-400 text-sm">{log.timestamp}</span>
                </div>
                <div className="text-zinc-300">
                  Admin: {log.admin_id} | Hedef: {log.target_user_id || 'N/A'}
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-2 text-sm text-zinc-400">
                    Detaylar: {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h2 className="text-2xl font-bold text-white mb-4">Veri Export İşlemleri</h2>
              <div className="bg-red-900 border border-red-700 p-4 rounded-xl mb-6">
                <h3 className="text-red-300 font-bold mb-2">⚠️ ÖNEMLİ UYARI</h3>
                <p className="text-red-200">
                  Bu işlem tüm kullanıcı verilerini export eder ve yasal makamlarla paylaşım için kullanılır. 
                  Her export işlemi loglanır ve izlenebilir.
                </p>
              </div>
              
              <button
                onClick={exportUserData}
                className="bg-orange-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-800 transition-colors border border-orange-700"
              >
                📤 TÜM KULLANICI VERİLERİNİ EXPORT ET
              </button>
              
              <div className="mt-6 text-sm text-zinc-400">
                <p>Export edilen veriler:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Kullanıcı profil bilgileri</li>
                  <li>E-posta adresleri ve kayıt tarihleri</li>
                  <li>Tüm karar metinleri ve seçimleri</li>
                  <li>Uygulama kullanım istatistikleri</li>
                  <li>Hesap durumları ve askı bilgileri</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-zinc-800">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Kullanıcı Detayları</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-zinc-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center space-x-4 mb-6">
                <img 
                  src={selectedUser.avatar} 
                  alt={selectedUser.name}
                  className="w-16 h-16 rounded-xl object-cover border border-zinc-700"
                />
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedUser.name}</h3>
                  <p className="text-zinc-400">@{selectedUser.username}</p>
                  <p className="text-zinc-400">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                  <div className="text-2xl font-bold text-white">{selectedUser.stats?.total_decisions || 0}</div>
                  <div className="text-zinc-400">Toplam Karar</div>
                </div>
                <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
                  <div className="text-2xl font-bold text-white">{selectedUser.stats?.success_rate || 0}%</div>
                  <div className="text-zinc-400">Başarı Oranı</div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-white font-semibold">Kayıt Tarihi:</label>
                  <p className="text-zinc-400">{selectedUser.created_at}</p>
                </div>
                
                <div>
                  <label className="text-white font-semibold">Hesap Durumu:</label>
                  <p className={selectedUser.is_suspended ? "text-red-400" : "text-green-400"}>
                    {selectedUser.is_suspended ? "Askıya Alınmış" : "Aktif"}
                  </p>
                </div>
                
                {selectedUser.is_suspended && (
                  <div>
                    <label className="text-white font-semibold">Askı Sebebi:</label>
                    <p className="text-red-400">{selectedUser.suspension_reason}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-white font-semibold">Kişisel Veri Sözleşmesi:</label>
                  <p className="text-green-400">
                    {selectedUser.privacy_agreement_accepted ? "Kabul Edildi" : "Kabul Edilmemiş"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Ana Sayfa ve diğer bileşenler aynı kalacak (mevcut kod)
const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [decisionText, setDecisionText] = useState("");
  const [alternatives, setAlternatives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [decisionId, setDecisionId] = useState(null);

  const handleSubmit = async () => {
    if (decisionText.trim()) {
      setLoading(true);
      try {
        const response = await apiCall(`${API}/decisions/create`, {
          method: 'POST',
          data: {
            text: decisionText,
            is_public: true
          }
        });
        
        setAlternatives(response.alternatives);
        setDecisionId(response.decision_id);
      } catch (error) {
        console.error('Decision creation failed:', error);
      }
      setLoading(false);
    }
  };

  const handleDiceRoll = () => {
    navigate('/dice', { 
      state: { 
        alternatives, 
        decisionText, 
        decisionId 
      } 
    });
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg dice-shadow">
              ⚫
            </div>
            <h1 className="text-2xl font-bold text-white">ZARVER</h1>
          </div>
          <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-xl overflow-hidden border-2 border-zinc-700">
            <img src={user?.avatar} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Karar Girişi */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h2 className="text-xl font-bold mb-4 text-white">
            Neyin kararsızlığını yaşıyorsun?
          </h2>
          
          <textarea
            value={decisionText}
            onChange={(e) => setDecisionText(e.target.value)}
            placeholder="Kararsızlığını buraya yaz..."
            className="w-full p-4 bg-zinc-800 border border-zinc-700 rounded-xl resize-none h-32 focus:outline-none focus:border-white text-white placeholder-zinc-500"
          />
          
          <button
            onClick={handleSubmit}
            disabled={!decisionText.trim() || loading}
            className="w-full mt-4 bg-white text-black py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 transition-all duration-200"
          >
            {loading ? "ALTERNATİFLER ÜRETİLİYOR..." : "ALTERNATİF ÜRET 🤖"}
          </button>
        </div>

        {/* AI Seçenekleri */}
        {alternatives.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h3 className="text-lg font-bold mb-4 text-white">
              Senin için üretilen seçenekler:
            </h3>
            
            <div className="space-y-3 mb-6">
              {alternatives.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-zinc-800 rounded-xl border border-zinc-700">
                  <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-bold text-lg dice-shadow">
                    {index + 1}
                  </div>
                  <span className="text-white font-medium">{option}</span>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleDiceRoll}
              className="w-full bg-zinc-800 text-white py-4 rounded-xl font-bold hover:bg-zinc-700 transition-all duration-200 flex items-center justify-center space-x-2 border border-zinc-700"
            >
              <span className="text-2xl">🎲</span>
              <span>ZAR AT VE KARAR VER!</span>
            </button>
          </div>
        )}

        {/* Hızlı Erişim */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/history')}
            className="bg-zinc-900 p-4 rounded-xl text-center hover:bg-zinc-800 transition-colors border border-zinc-800"
          >
            <div className="text-2xl mb-2">📈</div>
            <div className="font-bold text-white">Geçmiş</div>
            <div className="text-sm text-zinc-400">Kararların</div>
          </button>
          
          <button 
            onClick={() => navigate('/messages')}
            className="bg-zinc-900 p-4 rounded-xl text-center hover:bg-zinc-800 transition-colors border border-zinc-800"
          >
            <div className="text-2xl mb-2">💬</div>
            <div className="font-bold text-white">Mesajlar</div>
            <div className="text-sm text-zinc-400">Sohbet</div>
          </button>
        </div>
      </div>

      {/* Alt Navigasyon */}
      <BottomNavigation />
    </div>
  );
};

// Diğer bileşenler aynı kalacak (DicePage, ResultPage, HistoryPage, ProfilePage, MessagesPage, BottomNavigation)
// [Mevcut kodun devamı...]
// [Önceki bileşenler buraya gelecek - DicePage, ResultPage, HistoryPage, ProfilePage, MessagesPage, BottomNavigation]

const DicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { alternatives = [], decisionText = "", decisionId } = location.state || {};
  
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState(null);
  const [diceNumber, setDiceNumber] = useState(1);

  const rollDice = async () => {
    setIsRolling(true);
    setResult(null);
    
    // Zar animasyon simülasyonu
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      setDiceNumber(Math.floor(Math.random() * 4) + 1);
      rollCount++;
      
      if (rollCount > 15) {
        clearInterval(rollInterval);
        // Backend'den gerçek sonucu al
        rollDiceBackend();
      }
    }, 100);
  };

  const rollDiceBackend = async () => {
    try {
      const response = await apiCall(`${API}/decisions/${decisionId}/roll`, {
        method: 'POST'
      });
      
      setDiceNumber(response.dice_result);
      setResult(response.dice_result);
      setIsRolling(false);
      
      setTimeout(() => {
        navigate('/result', { 
          state: { 
            selectedOption: response.selected_option,
            diceResult: response.dice_result,
            decisionText,
            alternatives,
            decisionId
          } 
        });
      }, 2500);
    } catch (error) {
      console.error('Dice roll failed:', error);
      setIsRolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="p-4 flex items-center justify-between text-white border-b border-zinc-800">
        <button onClick={() => navigate(-1)} className="text-2xl hover:text-zinc-400">←</button>
        <h1 className="text-xl font-bold">ZAR ATMA ZAMANI!</h1>
        <div></div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl p-8 text-center max-w-md w-full border border-zinc-800">
          <h2 className="text-white text-lg mb-6 leading-relaxed font-medium">
            "{decisionText}"
          </h2>
          
          {/* Zar */}
          <div className="mb-8">
            <div className={`w-32 h-32 mx-auto bg-white rounded-2xl shadow-2xl flex items-center justify-center text-6xl font-bold text-black transition-transform duration-100 dice-shadow ${isRolling ? 'animate-bounce' : ''}`}>
              <div className="flex flex-wrap w-20 h-20 items-center justify-center">
                {Array.from({length: diceNumber}, (_, i) => (
                  <div key={i} className="w-3 h-3 bg-black rounded-full m-1"></div>
                ))}
              </div>
            </div>
          </div>

          {/* Seçenekler */}
          <div className="space-y-2 mb-8">
            {alternatives.map((option, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-xl transition-all border ${
                  result === index + 1 
                    ? 'bg-white text-black border-white font-bold' 
                    : 'bg-zinc-800 text-white border-zinc-700'
                }`}
              >
                <span className="font-bold mr-2">{index + 1}:</span>
                {option}
              </div>
            ))}
          </div>

          {!isRolling && !result && (
            <button
              onClick={rollDice}
              className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-zinc-200 transition-colors"
            >
              🎲 ZAR AT!
            </button>
          )}

          {isRolling && (
            <div className="text-white text-lg font-bold animate-pulse">
              Zar atılıyor...
            </div>
          )}

          {result && (
            <div className="text-white text-lg font-bold">
              Sonucuna yönlendiriliyor...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ResultPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedOption, diceResult, decisionText, decisionId } = location.state || {};
  const [implemented, setImplemented] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImplemented = async (didImplement) => {
    setLoading(true);
    try {
      await apiCall(`${API}/decisions/${decisionId}/implement?implemented=${didImplement}`, {
        method: 'POST'
      });
      
      setImplemented(didImplement);
      setTimeout(() => {
        navigate('/home');
      }, 2000);
    } catch (error) {
      console.error('Implementation update failed:', error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="p-4 flex items-center justify-between text-white border-b border-zinc-800">
        <button onClick={() => navigate('/home')} className="text-2xl hover:text-zinc-400">✕</button>
        <h1 className="text-xl font-bold">KARARIN BELLİ!</h1>
        <div></div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl p-8 text-center max-w-md w-full border border-zinc-800">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl dice-shadow">
            🎯
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-6">
            ZAR KONUŞTU!
          </h2>
          
          <div className="bg-zinc-800 rounded-xl p-4 mb-6 border border-zinc-700">
            <div className="text-sm text-zinc-400 mb-2">Senin kararın:</div>
            <div className="text-lg font-medium text-white mb-4">
              "{decisionText}"
            </div>
            
            <div className="flex items-center justify-center space-x-4 bg-zinc-700 rounded-xl p-4 border border-zinc-600">
              <div className="w-16 h-16 bg-white text-black rounded-xl flex items-center justify-center font-bold text-xl dice-shadow">
                <div className="flex flex-wrap w-10 h-10 items-center justify-center">
                  {Array.from({length: diceResult}, (_, i) => (
                    <div key={i} className="w-2 h-2 bg-black rounded-full m-0.5"></div>
                  ))}
                </div>
              </div>
              <div className="text-lg font-bold text-white flex-1">
                {selectedOption}
              </div>
            </div>
          </div>

          {implemented === null && !loading && (
            <div>
              <p className="text-zinc-300 mb-6 font-medium">
                Bu kararı uyguladın mı?
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => handleImplemented(true)}
                  className="flex-1 bg-white text-black py-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                >
                  ✅ Evet!
                </button>
                
                <button
                  onClick={() => handleImplemented(false)}
                  className="flex-1 bg-zinc-700 text-white py-3 rounded-xl font-bold hover:bg-zinc-600 transition-colors border border-zinc-600"
                >
                  ❌ Hayır
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-zinc-400 font-medium animate-pulse">
              Kaydediliyor...
            </div>
          )}

          {implemented === true && (
            <div className="text-white font-bold animate-fadeIn">
              🎉 Harika! Cesaretin için tebrikler!
            </div>
          )}

          {implemented === false && (
            <div className="text-zinc-400 font-bold animate-fadeIn">
              😊 Sorun değil, bir dahaki sefere!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiCall(`${API}/decisions/history`);
        setDecisions(data);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      }
      setLoading(false);
    };
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="dice-loader">
          <div className="dice-face">🎲</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl text-white hover:text-zinc-400">←</button>
          <h1 className="text-xl font-bold text-white">KARAR GEÇMİŞİ</h1>
          <div></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <div className="space-y-4">
          {decisions.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">🎲</div>
              <h3 className="text-xl font-bold text-white mb-2">Henüz karar vermedin</h3>
              <p className="text-zinc-400">İlk kararını vermek için ana sayfaya git</p>
              <button 
                onClick={() => navigate('/home')}
                className="mt-4 bg-white text-black px-6 py-2 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
              >
                KARAR VER
              </button>
            </div>
          ) : (
            decisions.map((decision) => (
              <div key={decision._id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-white font-medium mb-2">{decision.text}</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-zinc-400">{decision.created_at}</span>
                      {decision.is_public ? (
                        <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded-full border border-zinc-600">Herkese Açık</span>
                      ) : (
                        <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full border border-zinc-700">Gizli</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {decision.selected_option && (
                  <div className="bg-zinc-800 rounded-lg p-3 mb-3 border border-zinc-700">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-white text-black rounded text-sm flex items-center justify-center font-bold dice-shadow">
                        <div className="flex flex-wrap w-5 h-5 items-center justify-center">
                          {Array.from({length: decision.dice_result}, (_, i) => (
                            <div key={i} className="w-1 h-1 bg-black rounded-full m-0.2"></div>
                          ))}
                        </div>
                      </div>
                      <span className="font-bold text-white">{decision.selected_option}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {decision.implemented === true ? (
                      <span className="text-white text-sm font-medium">✅ Uygulandı</span>
                    ) : decision.implemented === false ? (
                      <span className="text-zinc-400 text-sm font-medium">❌ Uygulanmadı</span>
                    ) : (
                      <span className="text-zinc-500 text-sm font-medium">⏳ Beklemede</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl text-white hover:text-zinc-400">←</button>
          <h1 className="text-xl font-bold text-white">PROFİL</h1>
          <div></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto mb-4 rounded-xl overflow-hidden border-2 border-zinc-700">
              <img src={user?.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-xl font-bold text-white">{user?.name}</h2>
            <p className="text-zinc-400">@{user?.username}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="text-2xl font-bold text-white">{user?.stats?.total_decisions || 0}</div>
              <div className="text-sm text-zinc-400">Toplam Karar</div>
            </div>
            <div className="text-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="text-2xl font-bold text-white">{user?.stats?.success_rate || 0}%</div>
              <div className="text-sm text-zinc-400">Başarı Oranı</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
          <button 
            onClick={() => navigate('/history')}
            className="w-full p-4 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between border-b border-zinc-800"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">📈</span>
              <span className="font-medium text-white">Karar Geçmişim</span>
            </div>
            <span className="text-zinc-400">→</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full p-4 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between text-red-400"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">🚪</span>
              <span className="font-medium">Çıkış Yap</span>
            </div>
            <span className="text-red-400">→</span>
          </button>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

const MessagesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl text-white hover:text-zinc-400">←</button>
          <h1 className="text-xl font-bold text-white">MESAJLAR</h1>
          <div></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <div className="text-center py-16">
          <div className="text-4xl mb-4">💬</div>
          <h3 className="text-xl font-bold text-white mb-2">Mesajlaşma yakında!</h3>
          <p className="text-zinc-400">Bu özellik üzerinde çalışıyoruz</p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/home', icon: '🏠', label: 'Ana Sayfa' },
    { path: '/history', icon: '📈', label: 'Geçmiş' },
    { path: '/messages', icon: '💬', label: 'Mesajlar' },
    { path: '/profile', icon: '👤', label: 'Profil' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 max-w-lg mx-auto">
      <div className="flex">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 py-3 px-2 text-center transition-colors ${
              location.pathname === item.path
                ? 'text-white bg-zinc-800'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <div className="text-xl mb-1">{item.icon}</div>
            <div className="text-xs font-medium">{item.label}</div>
          </button>
        ))}
      </div>
    </nav>
  );
};

// Ana App Bileşeni
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<OnboardingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/admin-login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/dice" element={<ProtectedRoute><DicePage /></ProtectedRoute>} />
            <Route path="/result" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;