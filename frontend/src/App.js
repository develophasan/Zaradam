import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";

// Mock kullanıcı verisi
const mockUser = {
  id: 1,
  name: "Ahmet Yılmaz",
  username: "@ahmetyilmaz",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
  stats: {
    totalDecisions: 47,
    implementedDecisions: 32,
    successRate: 68,
    followers: 125,
    following: 89
  }
};

// Mock kararlar verisi
const mockDecisions = [
  {
    id: 1,
    text: "Bu hafta sonu dağa mı çıkayım yoksa evde dinleneyim mi?",
    options: ["Dağa çık", "Evde dinlen", "Arkadaşlarla buluş", "Yeni bir hobi dene"],
    diceResult: 1,
    selectedOption: "Dağa çık",
    implemented: true,
    createdAt: "2024-01-15",
    isPublic: true
  },
  {
    id: 2,
    text: "Yeni iş teklifini kabul etmeli miyim?",
    options: ["Kabul et", "Reddet", "Pazarlık yap", "Daha fazla düşün"],
    diceResult: 3,
    selectedOption: "Pazarlık yap",
    implemented: false,
    createdAt: "2024-01-14",
    isPublic: false
  }
];

// Onboarding Sayfası
const OnboardingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl">
            🎲
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Zarver</h1>
          <p className="text-gray-600">Kararsızlıklarını zar ile çöz!</p>
        </div>
        
        <div className="space-y-6 mb-8">
          <div className="flex items-start space-x-4">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              ✨
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">AI Destekli Çözümler</h3>
              <p className="text-sm text-gray-600">Kararsızlığını yaz, akıllı alternatifler al</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              🎯
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Zar ile Karar Ver</h3>
              <p className="text-sm text-gray-600">Şansın seni nereye götürüyor?</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              👥
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-800">Sosyal Deneyim</h3>
              <p className="text-sm text-gray-600">Arkadaşlarınla kararlarını paylaş</p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => navigate('/home')}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
        >
          Başlayalım!
        </button>
      </div>
    </div>
  );
};

// Ana Sayfa
const HomePage = () => {
  const navigate = useNavigate();
  const [decisionText, setDecisionText] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [mockOptions] = useState([
    "Spor salonuna git",
    "Evde film izle", 
    "Arkadaşlarla dışarı çık",
    "Yeni bir kitap oku"
  ]);

  const handleSubmit = () => {
    if (decisionText.trim()) {
      setShowOptions(true);
      // Gerçekte burada GPT API çağrısı yapılacak
    }
  };

  const handleDiceRoll = () => {
    navigate('/dice', { state: { options: mockOptions, decisionText } });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Zarver
          </h1>
          <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-full overflow-hidden">
            <img src={mockUser.avatar} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Karar Girişi */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Neyin kararsızlığını yaşıyorsun?
          </h2>
          
          <textarea
            value={decisionText}
            onChange={(e) => setDecisionText(e.target.value)}
            placeholder="Örn: Bu akşam ne yapmalıyım? Evde kalmak mı dışarı çıkmak mı daha iyi olur..."
            className="w-full p-4 border border-gray-200 rounded-xl resize-none h-32 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
          />
          
          <button
            onClick={handleSubmit}
            disabled={!decisionText.trim()}
            className="w-full mt-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-200"
          >
            Alternatif Üret ✨
          </button>
        </div>

        {/* AI Seçenekleri */}
        {showOptions && (
          <div className="bg-white rounded-2xl p-6 shadow-sm animate-fadeIn">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              İşte senin için üretilen seçenekler:
            </h3>
            
            <div className="space-y-3 mb-6">
              {mockOptions.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-400 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <span className="text-gray-700">{option}</span>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleDiceRoll}
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <span>🎲</span>
              <span>Zar At ve Karar Ver!</span>
            </button>
          </div>
        )}

        {/* Hızlı Erişim */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/history')}
            className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-2">📈</div>
            <div className="font-semibold text-gray-800">Geçmiş</div>
            <div className="text-sm text-gray-600">{mockDecisions.length} karar</div>
          </button>
          
          <button 
            onClick={() => navigate('/messages')}
            className="bg-white p-4 rounded-xl shadow-sm text-center hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-2">💬</div>
            <div className="font-semibold text-gray-800">Mesajlar</div>
            <div className="text-sm text-gray-600">3 yeni</div>
          </button>
        </div>
      </div>

      {/* Alt Navigasyon */}
      <BottomNavigation />
    </div>
  );
};

// Zar Atma Sayfası
const DicePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { options, decisionText } = location.state || { options: [], decisionText: "" };
  
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState(null);
  const [diceNumber, setDiceNumber] = useState(1);

  const rollDice = () => {
    setIsRolling(true);
    setResult(null);
    
    // Zar animasyon simülasyonu
    let rollCount = 0;
    const rollInterval = setInterval(() => {
      setDiceNumber(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      
      if (rollCount > 10) {
        clearInterval(rollInterval);
        const finalResult = Math.floor(Math.random() * options.length) + 1;
        setDiceNumber(finalResult);
        setResult(finalResult);
        setIsRolling(false);
        
        setTimeout(() => {
          navigate('/result', { 
            state: { 
              selectedOption: options[finalResult - 1],
              diceResult: finalResult,
              decisionText,
              options 
            } 
          });
        }, 2000);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex flex-col">
      <header className="p-4 flex items-center justify-between text-white">
        <button onClick={() => navigate(-1)} className="text-2xl">←</button>
        <h1 className="text-xl font-semibold">Zar Atma Zamanı!</h1>
        <div></div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8 text-center max-w-md w-full">
          <h2 className="text-white text-lg mb-6 leading-relaxed">
            "{decisionText}"
          </h2>
          
          {/* Zar */}
          <div className="mb-8">
            <div className={`w-32 h-32 mx-auto bg-white rounded-2xl shadow-xl flex items-center justify-center text-6xl font-bold text-gray-800 transition-transform duration-100 ${isRolling ? 'animate-bounce' : ''}`}>
              {diceNumber}
            </div>
          </div>

          {/* Seçenekler */}
          <div className="space-y-2 mb-8">
            {options.map((option, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-xl text-white transition-all ${
                  result === index + 1 ? 'bg-white/30 ring-2 ring-white' : 'bg-white/10'
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
              className="w-full bg-white text-purple-600 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
            >
              🎲 Zar At!
            </button>
          )}

          {isRolling && (
            <div className="text-white text-lg font-semibold animate-pulse">
              Zar atılıyor...
            </div>
          )}

          {result && (
            <div className="text-white text-lg font-semibold">
              Sonucuna yönlendiriliyor...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sonuç Sayfası
const ResultPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedOption, diceResult, decisionText } = location.state || {};
  const [implemented, setImplemented] = useState(null);

  const handleImplemented = (didImplement) => {
    setImplemented(didImplement);
    // Burada veritabanına kaydedilecek
    setTimeout(() => {
      navigate('/home');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-teal-600 flex flex-col">
      <header className="p-4 flex items-center justify-between text-white">
        <button onClick={() => navigate('/home')} className="text-2xl">✕</button>
        <h1 className="text-xl font-semibold">Kararın Belli!</h1>
        <div></div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-teal-400 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl">
            🎯
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Zar Konuştu!
          </h2>
          
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="text-sm text-gray-600 mb-2">Senin kararın:</div>
            <div className="text-lg font-semibold text-gray-800 mb-4">
              "{decisionText}"
            </div>
            
            <div className="flex items-center justify-center space-x-3 bg-gradient-to-r from-green-100 to-teal-100 rounded-xl p-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-teal-400 text-white rounded-xl flex items-center justify-center font-bold text-xl">
                {diceResult}
              </div>
              <div className="text-lg font-semibold text-gray-800">
                {selectedOption}
              </div>
            </div>
          </div>

          {implemented === null && (
            <div>
              <p className="text-gray-600 mb-6">
                Bu kararı uyguladın mı?
              </p>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => handleImplemented(true)}
                  className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors"
                >
                  ✅ Evet, uyguladım!
                </button>
                
                <button
                  onClick={() => handleImplemented(false)}
                  className="flex-1 bg-gray-400 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-colors"
                >
                  ❌ Hayır, uygulamadım
                </button>
              </div>
            </div>
          )}

          {implemented === true && (
            <div className="text-green-600 font-semibold animate-fadeIn">
              🎉 Harika! Cesaretin için tebrikler!
            </div>
          )}

          {implemented === false && (
            <div className="text-gray-600 font-semibold animate-fadeIn">
              😊 Sorun değil, bir dahaki sefere!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Geçmiş Sayfası
const HistoryPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-xl font-semibold">Karar Geçmişi</h1>
          <div></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <div className="space-y-4">
          {mockDecisions.map((decision) => (
            <div key={decision.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-gray-800 font-medium mb-2">{decision.text}</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{decision.createdAt}</span>
                    {decision.isPublic ? (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Herkese Açık</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Gizli</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-blue-400 text-white rounded text-sm flex items-center justify-center font-bold">
                    {decision.diceResult}
                  </div>
                  <span className="font-semibold text-gray-800">{decision.selectedOption}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {decision.implemented ? (
                    <span className="text-green-600 text-sm font-medium">✅ Uygulandı</span>
                  ) : (
                    <span className="text-gray-500 text-sm font-medium">❌ Uygulanmadı</span>
                  )}
                </div>
                <button className="text-gray-400 text-sm">•••</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

// Profil Sayfası
const ProfilePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-xl font-semibold">Profil</h1>
          <button onClick={() => navigate('/settings')} className="text-2xl">⚙️</button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        {/* Profil Bilgileri */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden">
              <img src={mockUser.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">{mockUser.name}</h2>
            <p className="text-gray-600">{mockUser.username}</p>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <div className="text-2xl font-bold text-purple-600">{mockUser.stats.totalDecisions}</div>
              <div className="text-sm text-gray-600">Toplam Karar</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-600">{mockUser.stats.successRate}%</div>
              <div className="text-sm text-gray-600">Başarı Oranı</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">{mockUser.stats.followers}</div>
              <div className="text-sm text-gray-600">Takipçi</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <div className="text-2xl font-bold text-orange-600">{mockUser.stats.following}</div>
              <div className="text-sm text-gray-600">Takip</div>
            </div>
          </div>

          {/* Butonlar */}
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/followers')}
              className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Takipçiler & Takip Edilenler
            </button>
          </div>
        </div>

        {/* Menü Seçenekleri */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button 
            onClick={() => navigate('/history')}
            className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">📈</span>
              <span className="font-medium">Karar Geçmişim</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>
          
          <button 
            onClick={() => navigate('/notifications')}
            className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">🔔</span>
              <span className="font-medium">Bildirimler</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>
          
          <button 
            onClick={() => navigate('/settings')}
            className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">⚙️</span>
              <span className="font-medium">Ayarlar</span>
            </div>
            <span className="text-gray-400">→</span>
          </button>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

// Mesajlaşma Sayfası
const MessagesPage = () => {
  const navigate = useNavigate();
  const mockMessages = [
    {
      id: 1,
      user: { name: "Ayşe Kaya", avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b098?w=150&h=150&fit=crop&crop=face" },
      lastMessage: "Harika karar! Ben de aynısını yapacağım 😊",
      time: "10:30",
      unread: 2
    },
    {
      id: 2,
      user: { name: "Mehmet Demir", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" },
      lastMessage: "O kararı nasıl verdin? Bana da önerebilir misin?",
      time: "09:15",
      unread: 0
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-xl font-semibold">Mesajlar</h1>
          <button className="text-2xl">✏️</button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <div className="space-y-2">
          {mockMessages.map((message) => (
            <button
              key={message.id}
              onClick={() => navigate(`/chat/${message.id}`)}
              className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                  <img src={message.user.avatar} alt={message.user.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-800 truncate">{message.user.name}</h3>
                    <span className="text-sm text-gray-500">{message.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600 text-sm truncate flex-1">{message.lastMessage}</p>
                    {message.unread > 0 && (
                      <span className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-2">
                        {message.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

// Chat Detay Sayfası
const ChatPage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  
  const mockChatMessages = [
    { id: 1, text: "Merhaba! Bugünkü kararın nasıldı?", sender: "other", time: "10:25" },
    { id: 2, text: "Çok iyiydi! Zar dağa çıkmamı söyledi ve gerçekten güzel bir gün geçirdim.", sender: "me", time: "10:27" },
    { id: 3, text: "Harika karar! Ben de aynısını yapacağım 😊", sender: "other", time: "10:30" }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center space-x-3">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <div className="w-10 h-10 rounded-full overflow-hidden">
            <img src="https://images.unsplash.com/photo-1494790108755-2616b612b098?w=150&h=150&fit=crop&crop=face" alt="User" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h1 className="font-semibold">Ayşe Kaya</h1>
            <p className="text-sm text-gray-500">Çevrimiçi</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mockChatMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
              msg.sender === 'me' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white text-gray-800 shadow-sm'
            }`}>
              <p className="text-sm">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-purple-100' : 'text-gray-500'}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border-t p-4">
        <div className="max-w-lg mx-auto flex space-x-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mesajını yaz..."
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-purple-400"
          />
          <button 
            disabled={!message.trim()}
            className="bg-purple-500 text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

// Bildirimler Sayfası
const NotificationsPage = () => {
  const navigate = useNavigate();
  
  const mockNotifications = [
    {
      id: 1,
      type: "follow",
      user: "Ahmet Yılmaz",
      text: "seni takip etmeye başladı",
      time: "2 saat önce",
      unread: true
    },
    {
      id: 2,
      type: "like",
      user: "Ayşe Kaya",
      text: "kararını beğendi",
      time: "5 saat önce",
      unread: true
    },
    {
      id: 3,
      type: "message",
      user: "Mehmet Demir",
      text: "sana mesaj gönderdi",
      time: "1 gün önce",
      unread: false
    }
  ];

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'follow': return '👤';
      case 'like': return '❤️';
      case 'message': return '💬';
      default: return '🔔';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-xl font-semibold">Bildirimler</h1>
          <button className="text-sm text-purple-600">Tümünü Okundu İşaretle</button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <div className="space-y-2">
          {mockNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-xl p-4 shadow-sm ${notification.unread ? 'border-l-4 border-purple-500' : ''}`}
            >
              <div className="flex items-start space-x-3">
                <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1">
                  <p className="text-gray-800">
                    <span className="font-semibold">{notification.user}</span> {notification.text}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{notification.time}</p>
                </div>
                {notification.unread && (
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

// Takipçiler Sayfası
const FollowersPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('followers');
  
  const mockFollowers = [
    { id: 1, name: "Ayşe Kaya", username: "@aysekaya", avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b098?w=150&h=150&fit=crop&crop=face", following: true },
    { id: 2, name: "Mehmet Demir", username: "@mehmetdemir", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face", following: false }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-xl font-semibold">Takip</h1>
          <div></div>
        </div>
      </header>

      {/* Tab Menü */}
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('followers')}
              className={`flex-1 py-4 text-center font-semibold ${
                activeTab === 'followers' 
                  ? 'text-purple-600 border-b-2 border-purple-600' 
                  : 'text-gray-500'
              }`}
            >
              Takipçiler ({mockUser.stats.followers})
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-4 text-center font-semibold ${
                activeTab === 'following' 
                  ? 'text-purple-600 border-b-2 border-purple-600' 
                  : 'text-gray-500'
              }`}
            >
              Takip Edilenler ({mockUser.stats.following})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        <div className="space-y-2">
          {mockFollowers.map((user) => (
            <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{user.name}</h3>
                  <p className="text-gray-600 text-sm">{user.username}</p>
                </div>
                <button
                  className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                    user.following
                      ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  }`}
                >
                  {user.following ? 'Takip Ediliyor' : 'Takip Et'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

// Ayarlar Sayfası
const SettingsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-xl font-semibold">Ayarlar</h1>
          <div></div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Hesap Ayarları */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <h2 className="p-4 font-semibold text-gray-800 border-b border-gray-100">Hesap</h2>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100">
            <span>Profil Düzenle</span>
            <span className="text-gray-400">→</span>
          </button>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between">
            <span>Şifre Değiştir</span>
            <span className="text-gray-400">→</span>
          </button>
        </div>

        {/* Gizlilik Ayarları */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <h2 className="p-4 font-semibold text-gray-800 border-b border-gray-100">Gizlilik</h2>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100">
            <span>Karar Gizliliği</span>
            <span className="text-gray-400">→</span>
          </button>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between">
            <span>Profil Gizliliği</span>
            <span className="text-gray-400">→</span>
          </button>
        </div>

        {/* Bildirim Ayarları */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <h2 className="p-4 font-semibold text-gray-800 border-b border-gray-100">Bildirimler</h2>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100">
            <span>Push Bildirimleri</span>
            <span className="text-gray-400">→</span>
          </button>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between">
            <span>Email Bildirimleri</span>
            <span className="text-gray-400">→</span>
          </button>
        </div>

        {/* Diğer */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <h2 className="p-4 font-semibold text-gray-800 border-b border-gray-100">Diğer</h2>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100">
            <span>Hakkında</span>
            <span className="text-gray-400">→</span>
          </button>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100">
            <span>Destek</span>
            <span className="text-gray-400">→</span>
          </button>
          <button className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between text-red-600">
            <span>Çıkış Yap</span>
            <span className="text-red-400">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Alt Navigasyon Bileşeni
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-w-lg mx-auto">
      <div className="flex">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 py-3 px-2 text-center ${
              location.pathname === item.path
                ? 'text-purple-600'
                : 'text-gray-500'
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
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<OnboardingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/dice" element={<DicePage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/followers" element={<FollowersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;