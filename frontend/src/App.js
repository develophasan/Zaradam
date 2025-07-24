import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Navigate } from "react-router-dom";
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

// Notification Bell Component
const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const data = await apiCall(`${API}/notifications/unread-count`);
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiCall(`${API}/notifications`);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiCall(`${API}/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      fetchUnreadCount();
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleBellClick = async () => {
    if (!showNotifications) {
      await fetchNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        className="relative text-white hover:text-zinc-400 transition-colors"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          {/* Mobile backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setShowNotifications(false)}
          ></div>
          
          <div className="absolute right-0 top-8 w-80 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden md:right-0">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Bildirimler</h3>
              <button 
                onClick={() => setShowNotifications(false)}
                className="text-zinc-400 hover:text-white md:hidden"
              >
                ✕
              </button>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-zinc-400">
                  Henüz bildiriminiz yok
                </div>
              ) : (
                notifications.map((notification, index) => (
                  <div
                    key={index}
                    onClick={() => !notification.read && markAsRead(notification._id)}
                    className={`p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors ${
                      !notification.read ? 'bg-zinc-800' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-2xl">
                        {notification.type === 'message' ? '💬' : 
                         notification.type === 'follow' ? '👥' : '🔔'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm break-words ${notification.read ? 'text-zinc-400' : 'text-white font-medium'}`}>
                          {notification.content}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {notification.created_at}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
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
          <h3 className="text-white font-bold mb-4">ZARADAM - KİŞİSEL VERİLERİN İŞLENMESİ AYDINLATMA METNİ</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-white font-semibold mb-2">1. Veri Sorumlusu</h4>
              <p>Zaradam Uygulaması, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla hareket etmektedir.</p>
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
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Hero Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1605870445919-838d190e8e1b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxkaWNlfGVufDB8fHxibHVlfDE3NTMzNjc0MDV8MA&ixlib=rb-4.1.0&q=85')"
        }}
      ></div>
      
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-2xl p-8 text-center border border-zinc-800 relative z-10">
        <div className="mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center text-4xl dice-shadow">
            🎲
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">ZARADAM</h1>
          <p className="text-zinc-400 text-lg">Kararsızlıklarını zar ile çöz</p>
        </div>
        
        <div className="space-y-6 mb-8">
          <div className="flex items-start space-x-4 text-left">
            <div 
              className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-zinc-700 bg-cover bg-center"
              style={{
                backgroundImage: "url('https://images.unsplash.com/photo-1697577418970-95d99b5a55cf?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlfGVufDB8fHx8MTc1MzM2NzQ0NXww&ixlib=rb-4.1.0&q=85')"
              }}
            >
              <span className="text-white bg-black bg-opacity-50 w-full h-full flex items-center justify-center rounded-xl">🤖</span>
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
            <div 
              className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-zinc-700 bg-cover bg-center"
              style={{
                backgroundImage: "url('https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwxfHxzb2NpYWwlMjBtZWRpYXxlbnwwfHx8fDE3NTMyOTk1Nzh8MA&ixlib=rb-4.1.0&q=85')"
              }}
            >
              <span className="text-white bg-black bg-opacity-50 w-full h-full flex items-center justify-center rounded-xl">👥</span>
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
            🎲
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
            🎲
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
  const [subscriptionStats, setSubscriptionStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [dashboard, userList, logList, subStats] = await Promise.all([
        apiCall(`${API}/admin/dashboard`),
        apiCall(`${API}/admin/users?limit=100`),
        apiCall(`${API}/admin/logs?limit=50`),
        apiCall(`${API}/admin/subscription-stats`)
      ]);
      
      setDashboardData(dashboard);
      setUsers(userList);
      setLogs(logList);
      setSubscriptionStats(subStats);
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
      a.download = `zaradam_export_${new Date().toISOString().split('T')[0]}.json`;
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

  const toggleUserPremium = async (userId) => {
    try {
      const response = await apiCall(`${API}/admin/user/${userId}/toggle-premium`, {
        method: 'POST'
      });
      
      if (response.success) {
        alert(response.message);
        // Refresh data
        await fetchDashboardData();
      }
    } catch (error) {
      console.error('Failed to toggle premium:', error);
      alert('Premium durum değiştirme başarısız: ' + (error.response?.data?.detail || error.message));
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
            <h1 className="text-2xl font-bold text-white">ZARADAM ADMİN</h1>
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
            { key: 'subscriptions', label: '💳 Abonelikler' },
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
          <div className="space-y-6">
            {/* General Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            
            {/* Subscription Stats */}
            {subscriptionStats && (
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                <h3 className="text-xl font-bold text-white mb-4">💳 Abonelik İstatistikleri</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400 mb-1">{subscriptionStats.premium_users}</div>
                    <div className="text-zinc-400 text-sm">Premium Kullanıcı</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-zinc-400 mb-1">{subscriptionStats.free_users}</div>
                    <div className="text-zinc-400 text-sm">Ücretsiz Kullanıcı</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400 mb-1">{subscriptionStats.premium_percentage}%</div>
                    <div className="text-zinc-400 text-sm">Premium Oranı</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-1">{subscriptionStats.recent_premium}</div>
                    <div className="text-zinc-400 text-sm">Son 30 Gün</div>
                  </div>
                </div>
              </div>
            )}
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
                        {user.subscription?.is_premium && (
                          <p className="text-yellow-400 text-sm font-semibold">
                            ✨ PREMIUM ÜYE
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* Premium Toggle */}
                      <button
                        onClick={() => toggleUserPremium(user._id)}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors border ${
                          user.subscription?.is_premium
                            ? 'bg-yellow-900 text-yellow-300 border-yellow-700 hover:bg-yellow-800'
                            : 'bg-yellow-600 text-black border-yellow-500 hover:bg-yellow-500'
                        }`}
                      >
                        {user.subscription?.is_premium ? 'Premium Kaldır' : 'Premium Yap'}
                      </button>
                      
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

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && subscriptionStats && (
          <div className="space-y-6">
            {/* Subscription Overview */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h2 className="text-2xl font-bold text-white mb-6">💳 Abonelik Yönetimi</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="text-center p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">{subscriptionStats.premium_users}</div>
                  <div className="text-yellow-300">Premium Kullanıcı</div>
                  <div className="text-xs text-yellow-500 mt-1">{subscriptionStats.premium_percentage}% toplam kullanıcının</div>
                </div>
                <div className="text-center p-4 bg-zinc-800 border border-zinc-700 rounded-xl">
                  <div className="text-3xl font-bold text-zinc-300 mb-2">{subscriptionStats.free_users}</div>
                  <div className="text-zinc-400">Ücretsiz Kullanıcı</div>
                  <div className="text-xs text-zinc-500 mt-1">Günlük 3 sorgu limiti</div>
                </div>
                <div className="text-center p-4 bg-green-900/20 border border-green-700/50 rounded-xl">
                  <div className="text-3xl font-bold text-green-400 mb-2">{subscriptionStats.recent_premium}</div>
                  <div className="text-green-300">Son 30 Günlük Premium</div>
                  <div className="text-xs text-green-500 mt-1">Yeni abonelikler</div>
                </div>
              </div>
              
              {/* Test Mode Warning */}
              <div className="bg-orange-900/20 border border-orange-700/50 p-4 rounded-xl mb-6">
                <h3 className="text-orange-300 font-bold mb-2">🧪 Test Modu Aktif</h3>
                <p className="text-orange-200 text-sm">
                  Şu anda test modundasınız. İyzico ödeme sistemi devre dışı - kullanıcılar gerçek ödeme yapmadan premium olabilir.
                  Admin olarak kullanıcılara manuel premium yetkisi verebilirsiniz.
                </p>
              </div>
            </div>

            {/* Premium Users List */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h3 className="text-xl font-bold text-white mb-4">✨ Premium Kullanıcılar</h3>
              <div className="space-y-3">
                {users.filter(user => user.subscription?.is_premium).map(user => (
                  <div key={user._id} className="flex items-center justify-between p-4 bg-yellow-900/10 border border-yellow-700/30 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={user.avatar} 
                        alt={user.name}
                        className="w-10 h-10 rounded-xl object-cover border border-yellow-700"
                      />
                      <div>
                        <h4 className="text-white font-semibold">{user.name}</h4>
                        <p className="text-zinc-400 text-sm">@{user.username}</p>
                        <p className="text-yellow-400 text-xs">
                          {user.subscription?.subscription_status === 'active_admin' ? '👑 Admin Verdi' : '💳 Ödeme Yaptı'}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleUserPremium(user._id)}
                      className="bg-red-900 text-white px-4 py-2 rounded-lg hover:bg-red-800 transition-colors border border-red-700 text-sm"
                    >
                      Premium Kaldır
                    </button>
                  </div>
                ))}
                
                {users.filter(user => user.subscription?.is_premium).length === 0 && (
                  <div className="text-center py-8 text-zinc-400">
                    Henüz premium kullanıcı bulunmuyor
                  </div>
                )}
              </div>
            </div>

            {/* Free Users - Potential Customers */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
              <h3 className="text-xl font-bold text-white mb-4">🆓 Ücretsiz Kullanıcılar (Premium Adayları)</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {users.filter(user => !user.subscription?.is_premium).slice(0, 10).map(user => (
                  <div key={user._id} className="flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={user.avatar} 
                        alt={user.name}
                        className="w-10 h-10 rounded-xl object-cover border border-zinc-700"
                      />
                      <div>
                        <h4 className="text-white font-semibold">{user.name}</h4>
                        <p className="text-zinc-400 text-sm">@{user.username}</p>
                        <p className="text-zinc-500 text-xs">
                          {user.subscription?.queries_used_today || 0}/3 günlük sorgu kullanıldı
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleUserPremium(user._id)}
                      className="bg-yellow-600 text-black px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors font-bold text-sm"
                    >
                      Premium Yap
                    </button>
                  </div>
                ))}
                
                {users.filter(user => !user.subscription?.is_premium).length > 10 && (
                  <div className="text-center text-zinc-400 text-sm">
                    ... ve {users.filter(user => !user.subscription?.is_premium).length - 10} kullanıcı daha
                  </div>
                )}
              </div>
            </div>
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
  const [privacyLevel, setPrivacyLevel] = useState("public");
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const data = await apiCall(`${API}/subscription/status`);
      setSubscriptionStatus(data);
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
    }
  };

  const handleSubmit = async () => {
    if (decisionText.trim()) {
      setLoading(true);
      try {
        const response = await apiCall(`${API}/decisions/create`, {
          method: 'POST',
          data: {
            text: decisionText,
            privacy_level: privacyLevel
          }
        });
        
        setAlternatives(response.alternatives);
        setDecisionId(response.decision_id);
        // Refresh subscription status to update query count
        await fetchSubscriptionStatus();
      } catch (error) {
        console.error('Decision creation failed:', error);
        if (error.response?.status === 403) {
          // Query limit exceeded
          alert(error.response.data.detail);
        }
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
              🎲
            </div>
            <h1 className="text-2xl font-bold text-white">ZARADAM</h1>
          </div>
          <div className="flex items-center space-x-3">
            {/* Premium Badge or Upgrade Button */}
            {subscriptionStatus?.is_premium ? (
              <div className="bg-green-900 px-2 py-1 rounded-lg border border-green-700">
                <span className="text-green-300 text-xs font-bold">✨ Premium</span>
              </div>
            ) : (
              <button
                onClick={() => navigate('/subscription')}
                className="bg-yellow-600 hover:bg-yellow-500 px-3 py-1 rounded-lg text-xs font-bold text-black transition-colors"
              >
                Upgrade
              </button>
            )}
            
            <NotificationBell />
            <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-xl overflow-hidden border-2 border-zinc-700">
              <img src={user?.avatar} alt="Profile" className="w-full h-full object-cover" />
            </button>
          </div>
        </div>
        
        {/* Query Counter Bar - Free Users Only */}
        {subscriptionStatus && !subscriptionStatus.is_premium && (
          <div className="bg-zinc-800 border-t border-zinc-700">
            <div className="max-w-lg mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{subscriptionStatus.queries_remaining}</span>
                    </div>
                    <span className="text-zinc-300 text-sm font-medium">Kalan ücretsiz sorgu</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="flex space-x-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i <= subscriptionStatus.queries_remaining
                            ? 'bg-blue-500'
                            : 'bg-zinc-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                
                {subscriptionStatus.queries_remaining === 0 && (
                  <button
                    onClick={() => navigate('/subscription')}
                    className="bg-yellow-600 hover:bg-yellow-500 px-3 py-1 rounded-lg text-xs font-bold text-black transition-colors"
                  >
                    Premium Al
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Query Limit Warning - Separate warning bar when no queries left */}
        {subscriptionStatus && !subscriptionStatus.is_premium && subscriptionStatus.queries_remaining === 0 && (
          <div className="bg-gradient-to-r from-red-900/80 to-orange-900/80 border-t border-red-700/50">
            <div className="max-w-lg mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-200 text-sm font-medium">⚡ Günlük limit doldu!</p>
                  <p className="text-red-300 text-xs">Premium ile sınırsız sorgu hakkı kazanın</p>
                </div>
                <button
                  onClick={() => navigate('/subscription')}
                  className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-white text-sm font-bold transition-colors"
                >
                  Premium Al
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6 pb-24">
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
          
          {/* Privacy Level Selector */}
          <div className="mt-4 mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Kararının gizliliği:
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setPrivacyLevel("public")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  privacyLevel === "public"
                    ? "bg-white text-black border-white"
                    : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                }`}
              >
                🌍 Herkese Açık
              </button>
              <button
                onClick={() => setPrivacyLevel("followers")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  privacyLevel === "followers"
                    ? "bg-white text-black border-white"
                    : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                }`}
              >
                👥 Takipçilerime
              </button>
              <button
                onClick={() => setPrivacyLevel("private")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  privacyLevel === "private"
                    ? "bg-white text-black border-white"
                    : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                }`}
              >
                🔒 Sadece Bana
              </button>
            </div>
          </div>
          
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

      <div className="max-w-lg mx-auto p-4 pb-24">
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
                      {(() => {
                        const privacyLevel = decision.privacy_level || (decision.is_public ? "public" : "private");
                        switch(privacyLevel) {
                          case "public":
                            return <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full border border-green-700">🌍 Herkese Açık</span>;
                          case "followers":
                            return <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded-full border border-blue-700">👥 Takipçilere</span>;
                          case "private":
                            return <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full border border-zinc-700">🔒 Gizli</span>;
                          default:
                            return <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded-full border border-zinc-600">Belirsiz</span>;
                        }
                      })()}
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
  const { user, logout, setUser } = useAuth();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Fotoğraf boyutu en fazla 2MB olabilir');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir resim dosyası seçin');
      return;
    }

    setIsUploadingPhoto(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result;
        
        try {
          const response = await apiCall(`${API}/auth/upload-profile-photo`, {
            method: 'POST',
            data: { photo_data: base64Data }
          });

          if (response.success) {
            // Update user avatar in auth context
            const updatedUser = { ...user, avatar: response.avatar };
            setUser(updatedUser);
            setShowPhotoUpload(false);
            alert('Profil fotoğrafı başarıyla güncellendi!');
          }
        } catch (error) {
          console.error('Photo upload error:', error);
          alert('Fotoğraf yükleme başarısız: ' + (error.response?.data?.detail || error.message));
        }
        
        setIsUploadingPhoto(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File processing error:', error);
      alert('Dosya işleme hatası');
      setIsUploadingPhoto(false);
    }
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

      <div className="max-w-lg mx-auto p-4 pb-24">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
          <div className="text-center mb-6">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-zinc-700">
                <img 
                  src={user?.avatar || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face"} 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <button
                onClick={() => setShowPhotoUpload(true)}
                className="absolute -bottom-1 -right-1 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold hover:bg-blue-500 transition-colors border-2 border-zinc-900 shadow-lg"
                title="Fotoğrafı Değiştir"
              >
                📷
              </button>
            </div>
            
            {/* Alternative: Add a text button as well */}
            <button
              onClick={() => setShowPhotoUpload(true)}
              className="mb-4 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              Profil Fotoğrafını Değiştir
            </button>
            <h2 className="text-xl font-bold text-white">{user?.name}</h2>
            <p className="text-zinc-400">@{user?.username}</p>
          </div>

          {/* Photo Upload Modal */}
          {showPhotoUpload && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
              <div className="bg-zinc-900 rounded-2xl max-w-sm w-full p-6 border border-zinc-800">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">Profil Fotoğrafı Yükle</h3>
                  <p className="text-zinc-400 text-sm">JPEG, PNG formatında, en fazla 2MB</p>
                </div>
                
                <div className="space-y-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="w-full p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-white file:text-black hover:file:bg-zinc-200"
                  />
                  
                  {isUploadingPhoto && (
                    <div className="text-center text-zinc-400">
                      Yükleniyor...
                    </div>
                  )}
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowPhotoUpload(false)}
                      disabled={isUploadingPhoto}
                      className="flex-1 bg-zinc-700 text-white py-3 rounded-xl font-bold hover:bg-zinc-600 transition-colors border border-zinc-600 disabled:opacity-50"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="text-2xl font-bold text-white">{user?.stats?.total_decisions || 0}</div>
              <div className="text-sm text-zinc-400">Toplam Karar</div>
            </div>
            <div className="text-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="text-2xl font-bold text-white">{user?.stats?.followers || 0}</div>
              <div className="text-sm text-zinc-400">Takipçi</div>
            </div>
            <div className="text-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="text-2xl font-bold text-white">{user?.stats?.following || 0}</div>
              <div className="text-sm text-zinc-400">Takip</div>
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
          
          {/* Premium/Subscription Section */}
          {user?.subscription?.is_premium ? (
            <button 
              onClick={() => navigate('/subscription')}
              className="w-full p-4 text-left hover:bg-zinc-800 transition-colors flex items-center justify-between border-b border-zinc-800"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">✨</span>
                <div>
                  <span className="font-medium text-green-400">Premium Üyelik</span>
                  <div className="text-xs text-green-500">Aktif</div>
                </div>
              </div>
              <span className="text-zinc-400">→</span>
            </button>
          ) : (
            <button 
              onClick={() => navigate('/subscription')}
              className="w-full p-4 text-left hover:bg-zinc-700 transition-colors flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-700/50"
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">⭐</span>
                <div>
                  <span className="font-medium text-yellow-400">Premium'a Geç</span>
                  <div className="text-xs text-yellow-500">Sınırsız sorgu - ₺29.99/ay</div>
                </div>
              </div>
              <span className="text-yellow-400">→</span>
            </button>
          )}
          
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
  const location = useLocation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showUserSearch, setShowUserSearch] = useState(false);

  useEffect(() => {
    fetchConversations();
    
    // Check if we should start a conversation (from user profile)
    if (location.state?.startConversation) {
      const { partner } = location.state.startConversation;
      setSelectedConversation({ partner });
      fetchConversationMessages(partner.id);
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchConversations = async () => {
    try {
      const data = await apiCall(`${API}/messages/conversations`);
      setConversations(data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
    setLoading(false);
  };

  const fetchConversationMessages = async (partnerId) => {
    try {
      const data = await apiCall(`${API}/messages/conversation/${partnerId}`);
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleConversationSelect = async (conversation) => {
    setSelectedConversation(conversation);
    await fetchConversationMessages(conversation.partner.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await apiCall(`${API}/messages/send`, {
        method: 'POST',
        data: {
          recipient_id: selectedConversation.partner.id,
          content: newMessage
        }
      });

      setNewMessage("");
      // Refresh messages
      await fetchConversationMessages(selectedConversation.partner.id);
      // Refresh conversations to update last message
      await fetchConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Mesaj gönderilemedi: ' + (error.response?.data?.detail || error.message));
    }
  };

  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await apiCall(`${API}/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(data);
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const handleFollowUser = async (userId) => {
    try {
      await apiCall(`${API}/users/follow`, {
        method: 'POST',
        data: { target_user_id: userId }
      });
      
      // Refresh search results
      await searchUsers(searchQuery);
      alert('Kullanıcı takip edildi! Karşılıklı takip olduktan sonra mesajlaşabilirsiniz.');
    } catch (error) {
      console.error('Failed to follow user:', error);
      alert('Takip edilemedi: ' + (error.response?.data?.detail || error.message));
    }
  };

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
          <h1 className="text-xl font-bold text-white">MESAJLAR</h1>
          <button 
            onClick={() => setShowUserSearch(!showUserSearch)}
            className="text-xl text-white hover:text-zinc-400"
          >
            {showUserSearch ? '✕' : '👥'}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {showUserSearch && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-900">
            <input
              type="text"
              placeholder="Kullanıcı ara..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchUsers(e.target.value);
              }}
              className="w-full p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
            />
            
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map(user => (
                  <div key={user._id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <img 
                        src={user.avatar} 
                        alt={user.name}
                        className="w-10 h-10 rounded-xl object-cover cursor-pointer"
                        onClick={() => navigate(`/user/${user._id}`)}
                      />
                      <div>
                        <div 
                          className="text-white font-semibold cursor-pointer hover:text-blue-400 transition-colors"
                          onClick={() => navigate(`/user/${user._id}`)}
                        >
                          {user.name}
                        </div>
                        <div className="text-zinc-400 text-sm">@{user.username}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigate(`/user/${user._id}`)}
                        className="bg-zinc-700 text-white px-3 py-1 rounded-lg text-sm hover:bg-zinc-600 transition-colors border border-zinc-600"
                      >
                        Profil
                      </button>
                      
                      {!user.is_following ? (
                        <button
                          onClick={() => handleFollowUser(user._id)}
                          className="bg-blue-900 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-800 transition-colors border border-blue-700"
                        >
                          Takip Et
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            // Navigate to messages with this user
                            navigate('/messages', { 
                              state: { 
                                startConversation: {
                                  partner: {
                                    id: user._id,
                                    name: user.name,
                                    username: user.username,
                                    avatar: user.avatar
                                  }
                                }
                              }
                            });
                          }}
                          className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-500 transition-colors"
                        >
                          Mesaj At
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedConversation ? (
          <div className="p-4 pb-24">
            {conversations.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">💬</div>
                <h3 className="text-xl font-bold text-white mb-2">Henüz mesajınız yok</h3>
                <p className="text-zinc-400 mb-4">Kullanıcı arayarak mesajlaşmaya başlayın</p>
                <button
                  onClick={() => setShowUserSearch(true)}
                  className="bg-white text-black px-6 py-2 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                >
                  Kullanıcı Ara
                </button>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {conversations.map((conversation, index) => (
                  <div
                    key={index}
                    onClick={() => handleConversationSelect(conversation)}
                    className="flex items-center space-x-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors"
                  >
                    <img 
                      src={conversation.partner.avatar} 
                      alt={conversation.partner.name}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-white">{conversation.partner.name}</h3>
                        <span className="text-sm text-zinc-400">{conversation.last_message.created_at}</span>
                      </div>
                      <p className="text-zinc-400 text-sm truncate">{conversation.last_message.content}</p>
                    </div>
                    {conversation.unread_count > 0 && (
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {conversation.unread_count}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-screen">
            {/* Conversation Header */}
            <div className="flex items-center space-x-3 p-4 border-b border-zinc-800 bg-zinc-900">
              <button
                onClick={() => setSelectedConversation(null)}
                className="text-xl text-white hover:text-zinc-400"
              >
                ←
              </button>
              <img 
                src={selectedConversation.partner.avatar} 
                alt={selectedConversation.partner.name}
                className="w-10 h-10 rounded-xl object-cover"
              />
              <div>
                <h3 className="font-semibold text-white">{selectedConversation.partner.name}</h3>
                <p className="text-zinc-400 text-sm">@{selectedConversation.partner.username}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ height: 'calc(100vh - 200px)' }}>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.is_own ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-xl ${
                      message.is_own
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-white border border-zinc-700'
                    }`}
                  >
                    <p>{message.content}</p>
                    <p className={`text-xs mt-1 ${message.is_own ? 'text-blue-200' : 'text-zinc-400'}`}>
                      {message.created_at}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900">
              <div className="flex space-x-3 items-end">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none min-h-[44px]"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center"
                >
                  Gönder
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!selectedConversation && <BottomNavigation />}
    </div>
  );
};

// Subscription Page
const SubscriptionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [cardData, setCardData] = useState({
    cardHolderName: '',
    cardNumber: '',
    expireMonth: '',
    expireYear: '',
    cvc: ''
  });

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const data = await apiCall(`${API}/subscription/status`);
      setSubscriptionStatus(data);
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
    }
    setLoading(false);
  };

  const handleSubscribe = async () => {
    // Validate card data
    if (!cardData.cardHolderName || !cardData.cardNumber || !cardData.expireMonth || !cardData.expireYear || !cardData.cvc) {
      alert('Lütfen tüm kart bilgilerini eksiksiz doldurun');
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await apiCall(`${API}/subscription/create-payment`, {
        method: 'POST',
        data: {
          card_holder_name: cardData.cardHolderName,
          card_number: cardData.cardNumber.replace(/\s/g, ''),
          expire_month: cardData.expireMonth,
          expire_year: cardData.expireYear,
          cvc: cardData.cvc
        }
      });

      if (response.success) {
        alert(response.message);
        await fetchSubscriptionStatus(); // Refresh status
        setCardData({ // Clear form
          cardHolderName: '',
          cardNumber: '',
          expireMonth: '',
          expireYear: '',
          cvc: ''
        });
      }
    } catch (error) {
      console.error('Subscription failed:', error);
      alert('Abonelik başarısız: ' + (error.response?.data?.detail || error.message));
    }
    setPaymentLoading(false);
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Aboneliğinizi iptal etmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await apiCall(`${API}/subscription/cancel`, {
        method: 'POST'
      });

      if (response.success) {
        alert(response.message);
        await fetchSubscriptionStatus();
      }
    } catch (error) {
      console.error('Cancellation failed:', error);
      alert('İptal işlemi başarısız: ' + (error.response?.data?.detail || error.message));
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0; i < match.length; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

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
          <h1 className="text-xl font-bold text-white">PREMİUM ÜYELİK</h1>
          <div></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 pb-24">
        {/* Current Status */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Mevcut Durumunuz</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Üyelik Durumu:</span>
              <span className={`font-bold ${subscriptionStatus?.is_premium ? 'text-green-400' : 'text-zinc-400'}`}>
                {subscriptionStatus?.is_premium ? '✨ Premium' : '🆓 Ücretsiz'}
              </span>
            </div>
            
            {!subscriptionStatus?.is_premium && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Günlük Sorgu:</span>
                <span className="text-white font-bold">
                  {subscriptionStatus?.queries_remaining || 0} / {subscriptionStatus?.daily_queries || 3}
                </span>
              </div>
            )}
            
            {subscriptionStatus?.is_premium && subscriptionStatus?.next_payment_date && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Sonraki Ödeme:</span>
                <span className="text-white font-bold">
                  {new Date(subscriptionStatus.next_payment_date).toLocaleDateString('tr-TR')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Premium Benefits */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Premium Avantajları</h2>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                ✓
              </div>
              <span className="text-white">Sınırsız AI karar alternatifleri</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                ✓
              </div>
              <span className="text-white">Premium destek</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                ✓
              </div>
              <span className="text-white">Reklamsız deneyim</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                ✓
              </div>
              <span className="text-white">Gelişmiş analitik</span>
            </div>
          </div>
        </div>

        {/* Test Mode Warning */}
        {!subscriptionStatus?.is_premium && (
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-2xl p-4 mb-6">
            <h3 className="text-blue-300 font-bold mb-2">🧪 Test Modunda</h3>
            <p className="text-blue-200 text-sm mb-3">
              Şu anda test modundayız. Gerçek ödeme yapmadan premium özelliklerini test edebilirsiniz.
            </p>
            <p className="text-blue-300 text-xs">
              Kart bilgilerini doldurup "Premium'a Geç" butonuna basarak test premium üyeliği alabilirsiniz.
            </p>
          </div>
        )}

        {/* Subscription Actions */}
        {!subscriptionStatus?.is_premium ? (
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-4">Premium'a Geçin</h2>
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-white">₺29.99</div>
              <div className="text-zinc-400">/ aylık</div>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Kart Sahibi Adı"
                value={cardData.cardHolderName}
                onChange={(e) => setCardData({...cardData, cardHolderName: e.target.value})}
                className="w-full p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
              />
              
              <input
                type="text"
                placeholder="Kart Numarası"
                value={cardData.cardNumber}
                onChange={(e) => setCardData({...cardData, cardNumber: formatCardNumber(e.target.value)})}
                maxLength="19"
                className="w-full p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
              />
              
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="MM"
                  value={cardData.expireMonth}
                  onChange={(e) => setCardData({...cardData, expireMonth: e.target.value.replace(/\D/g, '').slice(0, 2)})}
                  className="p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
                />
                
                <input
                  type="text"
                  placeholder="YYYY"
                  value={cardData.expireYear}
                  onChange={(e) => setCardData({...cardData, expireYear: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                  className="p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
                />
                
                <input
                  type="text"
                  placeholder="CVC"
                  value={cardData.cvc}
                  onChange={(e) => setCardData({...cardData, cvc: e.target.value.replace(/\D/g, '').slice(0, 3)})}
                  className="p-3 bg-zinc-800 text-white rounded-xl border border-zinc-700 focus:border-white focus:outline-none"
                />
              </div>
              
              <button
                onClick={handleSubscribe}
                disabled={paymentLoading}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paymentLoading ? "İşleniyor..." : "Premium'a Geç - ₺29.99/ay"}
              </button>
            </div>
            
            <div className="mt-4 text-xs text-zinc-400 text-center">
              İyzico güvenli ödeme sistemi ile korunuyorsunuz. İstediğiniz zaman iptal edebilirsiniz.
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h2 className="text-xl font-bold text-green-400 mb-4">✨ Premium Üyesiniz!</h2>
            <p className="text-zinc-300 mb-6">Sınırsız sorgu hakkınız var ve tüm premium özelliklerden faydalanabiliyorsunuz.</p>
            
            <button
              onClick={handleCancelSubscription}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-500 transition-colors"
            >
              Aboneliği İptal Et
            </button>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

// User Profile Page (for viewing other users)
const UserProfilePage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      // Get user info from search to check follow status
      const searchResults = await apiCall(`${API}/users/search?q=${userId}`);
      const foundUser = searchResults.find(u => u._id === userId);
      
      if (foundUser) {
        setUser(foundUser);
        setIsFollowing(foundUser.is_following);
      } else {
        throw new Error('Kullanıcı bulunamadı');
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      alert('Kullanıcı profili yüklenemedi');
      navigate(-1);
    }
    setLoading(false);
  };

  const handleFollowToggle = async () => {
    if (followLoading) return;
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await apiCall(`${API}/users/unfollow/${userId}`, {
          method: 'DELETE'
        });
        setIsFollowing(false);
        alert('Takibi bıraktınız');
      } else {
        await apiCall(`${API}/users/follow`, {
          method: 'POST',
          data: { target_user_id: userId }
        });
        setIsFollowing(true);
        alert('Kullanıcı takip edildi!');
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      alert('İşlem başarısız: ' + (error.response?.data?.detail || error.message));
    }
    setFollowLoading(false);
  };

  const handleSendMessage = () => {
    if (!isFollowing) {
      alert('Mesaj göndermek için önce takip etmelisiniz');
      return;
    }
    
    // Navigate to messages page with user info
    navigate('/messages', { 
      state: { 
        startConversation: {
          partner: {
            id: user._id,
            name: user.name,
            username: user.username,
            avatar: user.avatar
          }
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="dice-loader">
          <div className="dice-face">🎲</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Kullanıcı bulunamadı</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl text-white hover:text-zinc-400">←</button>
          <h1 className="text-xl font-bold text-white">PROFİL</h1>
          <div></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 pb-24">
        {/* User Profile Info */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto mb-4 rounded-xl overflow-hidden border-2 border-zinc-700">
              <img 
                src={user.avatar || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face"} 
                alt="Profile" 
                className="w-full h-full object-cover" 
              />
            </div>
            
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <p className="text-zinc-400">@{user.username}</p>
            <p className="text-zinc-500 text-sm mt-1">Katılım: {user.created_at}</p>
            
            {user.subscription?.is_premium && (
              <div className="mt-2">
                <span className="bg-yellow-900 text-yellow-300 px-3 py-1 rounded-full text-xs font-bold border border-yellow-700">
                  ✨ Premium Üye
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="text-2xl font-bold text-white">{user.stats?.total_decisions || 0}</div>
              <div className="text-sm text-zinc-400">Karar</div>
            </div>
            <div className="text-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="text-2xl font-bold text-white">{user.stats?.followers || 0}</div>
              <div className="text-sm text-zinc-400">Takipçi</div>
            </div>
            <div className="text-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="text-2xl font-bold text-white">{user.stats?.following || 0}</div>
              <div className="text-sm text-zinc-400">Takip</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`w-full py-3 rounded-xl font-bold transition-colors disabled:opacity-50 ${
                isFollowing
                  ? 'bg-zinc-700 text-white border border-zinc-600 hover:bg-zinc-600'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {followLoading ? 'İşleniyor...' : (isFollowing ? '✓ Takip Ediliyor' : '+ Takip Et')}
            </button>
            
            <button
              onClick={handleSendMessage}
              disabled={!isFollowing}
              className={`w-full py-3 rounded-xl font-bold transition-colors ${
                isFollowing
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
            >
              💬 Mesaj Gönder
            </button>
            
            {!isFollowing && (
              <p className="text-center text-zinc-500 text-xs">
                Mesaj göndermek için önce takip etmelisiniz
              </p>
            )}
          </div>
        </div>

        {/* Public Decisions - if any */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <h3 className="text-lg font-bold text-white mb-4">Herkese Açık Kararlar</h3>
          <div className="text-center py-8 text-zinc-400">
            <div className="text-4xl mb-2">🤐</div>
            <p>Bu kullanıcının herkese açık kararı bulunmuyor</p>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadMessages = async () => {
    try {
      const conversations = await apiCall(`${API}/messages/conversations`);
      const totalUnread = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
      setUnreadMessages(totalUnread);
    } catch (error) {
      console.error('Failed to fetch unread messages:', error);
    }
  };

  const navItems = [
    { path: '/home', icon: '🏠', label: 'Ana Sayfa' },
    { path: '/history', icon: '📈', label: 'Geçmiş' },
    { path: '/messages', icon: '💬', label: 'Mesajlar' },
    { path: '/profile', icon: '👤', label: 'Profil' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 max-w-lg mx-auto z-50">
      <div className="flex">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 py-4 px-2 text-center transition-colors relative min-h-[60px] ${
              location.pathname === item.path
                ? 'text-white bg-zinc-800'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <div className="text-xl mb-1">
              {item.icon}
              {item.path === '/messages' && unreadMessages > 0 && (
                <span className="absolute top-1 right-2 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </div>
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
            <Route path="/user/:userId" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
            <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;