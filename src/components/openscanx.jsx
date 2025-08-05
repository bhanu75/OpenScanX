import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Upload, FileText, Edit3, Download, Share2, Search, Plus, MoreVertical, RotateCcw, RotateCw, Crop, Filter, Type, PenTool, Eraser, Save, ArrowLeft, Eye, Trash2, Copy } from 'lucide-react';

// Utility functions for IndexedDB
const DB_NAME = 'OpenScanX';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

const saveDocument = async (doc) => {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  return store.put(doc);
};

const getDocuments = async () => {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

const deleteDocument = async (id) => {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  return store.delete(id);
};

// Main App Component
const OpenScanXApp = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [documents, setDocuments] = useState([]);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const createNewDocument = (imageData, name = 'New Document') => {
    const doc = {
      id: Date.now().toString(),
      name,
      pages: [{ 
        id: '1', 
        imageData, 
        originalImageData: imageData,
        annotations: [],
        ocrText: ''
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCurrentDocument(doc);
    return doc;
  };

  const saveCurrentDocument = async () => {
    if (currentDocument) {
      try {
        await saveDocument(currentDocument);
        await loadDocuments();
      } catch (error) {
        console.error('Error saving document:', error);
      }
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.pages.some(page => page.ocrText?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard 
          documents={filteredDocuments}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onNewScan={() => setCurrentView('scanner')}
          onOpenDocument={(doc) => {
            setCurrentDocument(doc);
            setCurrentView('editor');
          }}
          onDeleteDocument={async (id) => {
            await deleteDocument(id);
            await loadDocuments();
          }}
        />;
      case 'scanner':
        return <Scanner 
          onImageCaptured={(imageData) => {
            createNewDocument(imageData);
            setCurrentView('editor');
          }}
          onBack={() => setCurrentView('dashboard')}
        />;
      case 'editor':
        return <Editor 
          document={currentDocument}
          onDocumentUpdate={setCurrentDocument}
          onNext={() => setCurrentView('markup')}
          onBack={() => setCurrentView('dashboard')}
        />;
      case 'markup':
        return <Markup 
          document={currentDocument}
          onDocumentUpdate={setCurrentDocument}
          onNext={() => setCurrentView('ocr')}
          onBack={() => setCurrentView('editor')}
        />;
      case 'ocr':
        return <OCR 
          document={currentDocument}
          onDocumentUpdate={setCurrentDocument}
          onNext={() => setCurrentView('export')}
          onBack={() => setCurrentView('markup')}
        />;
      case 'export':
        return <Export 
          document={currentDocument}
          onSave={async () => {
            await saveCurrentDocument();
            setCurrentView('dashboard');
          }}
          onBack={() => setCurrentView('ocr')}
        />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderCurrentView()}
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ documents, searchTerm, setSearchTerm, sortBy, setSortBy, onNewScan, onOpenDocument, onDeleteDocument }) => {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">OpenScanX</h1>
          <p className="text-gray-600 mt-1">Your documents, scanned and organized</p>
        </div>
        <button
          onClick={onNewScan}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">New Scan</span>
        </button>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="date">Sort by Date</option>
          <option value="name">Sort by Name</option>
          <option value="pages">Sort by Pages</option>
        </select>
      </div>

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No documents yet</h3>
          <p className="text-gray-500 mb-6">Start by scanning your first document</p>
          <button
            onClick={onNewScan}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto"
          >
            <Camera size={20} />
            Start Scanning
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onOpen={() => onOpenDocument(doc)}
              onDelete={() => onDeleteDocument(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Document Card Component
const DocumentCard = ({ document, onOpen, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer relative">
      <div onClick={onOpen} className="p-4">
        {/* Document Preview */}
        <div className="aspect-[3/4] bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
          {document.pages[0]?.imageData ? (
            <img 
              src={document.pages[0].imageData} 
              alt="Document preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <FileText size={48} className="text-gray-400" />
          )}
        </div>
        
        {/* Document Info */}
        <h3 className="font-semibold text-gray-900 truncate mb-1">{document.name}</h3>
        <p className="text-sm text-gray-500">
          {document.pages.length} page{document.pages.length !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(document.createdAt).toLocaleDateString()}
        </p>
      </div>
      
      {/* Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
      >
        <MoreVertical size={16} />
      </button>
      
      {/* Menu Dropdown */}
      {showMenu && (
        <div className="absolute top-8 right-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
          >
            <Eye size={14} />
            Open
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

// Scanner Component
const Scanner = ({ onImageCaptured, onBack }) => {
  const fileInputRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageCaptured(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      videoRef.current.srcObject = mediaStream;
      setCameraActive(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please try uploading an image instead.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    stopCamera();
    onImageCaptured(imageData);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-semibold">Scan Document</h1>
        </div>
      </div>

      {/* Camera/Upload Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {cameraActive ? (
          <div className="relative w-full max-w-md">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto rounded-lg"
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
              <button
                onClick={stopCamera}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="bg-white hover:bg-gray-100 text-gray-900 px-6 py-2 rounded-lg font-semibold"
              >
                Capture
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mb-8">
              <Camera size={64} className="mx-auto text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Scan Your Document</h2>
              <p className="text-gray-300">Use your camera or upload an image</p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={startCamera}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg flex items-center justify-center gap-3 text-lg"
              >
                <Camera size={24} />
                Use Camera
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-4 rounded-lg flex items-center justify-center gap-3 text-lg"
              >
                <Upload size={24} />
                Upload Image
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

// Editor Component
const Editor = ({ document, onDocumentUpdate, onNext, onBack }) => {
  const canvasRef = useRef();
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [filter, setFilter] = useState('original');
  const [cropMode, setCropMode] = useState(false);
  const [cropPoints, setCropPoints] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPoint, setDragPoint] = useState(null);
  
  const filters = [
    { name: 'Original', value: 'original' },
    { name: 'B&W', value: 'bw' },
    { name: 'Enhanced', value: 'enhanced' },
    { name: 'Sepia', value: 'sepia' }
  ];

  useEffect(() => {
    if (document?.pages[0]?.imageData) {
      applyChanges();
    }
  }, [rotation, brightness, contrast, filter, document]);

  useEffect(() => {
    if (cropMode && !cropPoints && canvasRef.current) {
      // Initialize crop points (auto-detect or default)
      autoDetectEdges();
    }
  }, [cropMode]);

  const autoDetectEdges = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    // Default crop area (can be enhanced with OpenCV.js later)
    const margin = 0.1; // 10% margin
    const defaultCrop = {
      topLeft: { x: canvas.width * margin, y: canvas.height * margin },
      topRight: { x: canvas.width * (1 - margin), y: canvas.height * margin },
      bottomLeft: { x: canvas.width * margin, y: canvas.height * (1 - margin) },
      bottomRight: { x: canvas.width * (1 - margin), y: canvas.height * (1 - margin) }
    };
    
    setCropPoints(defaultCrop);
  };

  const applyChanges = () => {
    if (!document?.pages[0]?.originalImageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Set canvas dimensions based on rotation
      if (rotation % 180 === 0) {
        canvas.width = img.width;
        canvas.height = img.height;
      } else {
        canvas.width = img.height;
        canvas.height = img.width;
      }
      
      // Clear and apply transformations
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      
      // Rotate
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-img.width / 2, -img.height / 2);
      
      // Apply filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) ${getFilterCSS(filter)}`;
      
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      
      // Draw crop overlay if in crop mode
      if (cropMode && cropPoints) {
        drawCropOverlay(ctx);
      }
      
      // Update document
      const updatedDoc = {
        ...document,
        pages: document.pages.map((page, index) => 
          index === 0 ? { ...page, imageData: canvas.toDataURL('image/jpeg', 0.8) } : page
        )
      };
      onDocumentUpdate(updatedDoc);
    };
    
    img.src = document.pages[0].originalImageData;
  };

  const drawCropOverlay = (ctx) => {
    if (!cropPoints) return;
    
    const { topLeft, topRight, bottomLeft, bottomRight } = cropPoints;
    
    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Clear crop area
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.fill();
    
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw crop border
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.stroke();
    
    // Draw corner handles
    const handleSize = 12;
    const corners = [topLeft, topRight, bottomLeft, bottomRight];
    
    ctx.fillStyle = '#3B82F6';
    corners.forEach(corner => {
      ctx.fillRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
    });
  };

  const handleCanvasMouseDown = (e) => {
    if (!cropMode || !cropPoints) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on a corner handle
    const handleSize = 12;
    const corners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
    
    for (const corner of corners) {
      const point = cropPoints[corner];
      if (Math.abs(x - point.x) <= handleSize && Math.abs(y - point.y) <= handleSize) {
        setIsDragging(true);
        setDragPoint(corner);
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDragging || !dragPoint || !cropPoints) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newCropPoints = {
      ...cropPoints,
      [dragPoint]: { x, y }
    };
    
    setCropPoints(newCropPoints);
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setDragPoint(null);
  };

  const applyCrop = () => {
    if (!cropPoints || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Create cropped image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Calculate crop dimensions
    const minX = Math.min(cropPoints.topLeft.x, cropPoints.bottomLeft.x);
    const maxX = Math.max(cropPoints.topRight.x, cropPoints.bottomRight.x);
    const minY = Math.min(cropPoints.topLeft.y, cropPoints.topRight.y);
    const maxY = Math.max(cropPoints.bottomLeft.y, cropPoints.bottomRight.y);
    
    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;
    
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    
    // Draw cropped image
    tempCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    // Update document with cropped image
    const croppedImageData = tempCanvas.toDataURL('image/jpeg', 0.8);
    const updatedDoc = {
      ...document,
      pages: document.pages.map((page, index) => 
        index === 0 ? { 
          ...page, 
          imageData: croppedImageData,
          originalImageData: croppedImageData
        } : page
      )
    };
    onDocumentUpdate(updatedDoc);
    setCropMode(false);
    setCropPoints(null);
  };

  const getFilterCSS = (filterType) => {
    switch (filterType) {
      case 'bw': return 'grayscale(100%)';
      case 'enhanced': return 'saturate(120%) contrast(110%)';
      case 'sepia': return 'sepia(100%)';
      default: return '';
    }
  };

  const rotate = (degrees) => {
    setRotation(prev => (prev + degrees) % 360);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold">Edit Document</h1>
          </div>
          <button
            onClick={onNext}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            Next
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Canvas Area */}
        <div className="flex-1 p-4 flex items-center justify-center bg-gray-200">
          <div className="max-w-full max-h-full overflow-auto">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full shadow-lg bg-white cursor-crosshair"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              style={{ cursor: cropMode ? 'crosshair' : 'default' }}
            />
          </div>
        </div>

        {/* Controls Panel */}
        <div className="w-full lg:w-80 bg-white shadow-lg p-6 space-y-6">
          {/* Crop Tools */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Crop</h3>
            <div className="space-y-2">
              <button
                onClick={() => setCropMode(!cropMode)}
                className={`w-full p-3 rounded-lg flex items-center justify-center gap-2 ${
                  cropMode ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Crop size={20} />
                {cropMode ? 'Exit Crop Mode' : 'Manual Crop'}
              </button>
              {cropMode && (
                <div className="flex gap-2">
                  <button
                    onClick={autoDetectEdges}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 p-2 rounded text-sm"
                  >
                    Auto Detect
                  </button>
                  <button
                    onClick={applyCrop}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2 rounded text-sm"
                  >
                    Apply Crop
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Rotation */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Rotation</h3>
            <div className="flex gap-2">
              <button
                onClick={() => rotate(-90)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 p-3 rounded-lg flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} />
                Left
              </button>
              <button
                onClick={() => rotate(90)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 p-3 rounded-lg flex items-center justify-center gap-2"
              >
                <RotateCw size={20} />
                Right
              </button>
            </div>
          </div>

          {/* Filters */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Filters</h3>
            <div className="grid grid-cols-2 gap-2">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`p-3 rounded-lg text-sm ${
                    filter === f.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Adjustments */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Adjustments</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Brightness: {brightness}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Contrast: {contrast}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Markup Component
const Markup = ({ document, onDocumentUpdate, onNext, onBack }) => {
  const canvasRef = useRef();
  const overlayCanvasRef = useRef();
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (document?.pages[0]?.imageData) {
      loadImage();
    }
  }, [document]);

  const loadImage = () => {
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!canvas || !overlayCanvas || !document?.pages[0]?.imageData) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate display size (maintain aspect ratio, max 800px width)
      const maxWidth = 800;
      const maxHeight = 600;
      let displayWidth = img.width;
      let displayHeight = img.height;
      
      if (displayWidth > maxWidth) {
        displayHeight = (displayHeight * maxWidth) / displayWidth;
        displayWidth = maxWidth;
      }
      
      if (displayHeight > maxHeight) {
        displayWidth = (displayWidth * maxHeight) / displayHeight;
        displayHeight = maxHeight;
      }
      
      // Set canvas dimensions
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      overlayCanvas.width = displayWidth;
      overlayCanvas.height = displayHeight;
      
      // Set display size
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';
      overlayCanvas.style.width = displayWidth + 'px';
      overlayCanvas.style.height = displayHeight + 'px';
      
      // Draw image
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    };
    
    img.src = document.pages[0].imageData;
  };

  const getMousePosition = (e) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const pos = getMousePosition(e);
    setLastPosition(pos);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getMousePosition(e);
    
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,0)' : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    
    ctx.beginPath();
    ctx.moveTo(lastPosition.x, lastPosition.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    setLastPosition(pos);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearAnnotations = () => {
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveAnnotations = () => {
    const baseCanvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    
    if (!baseCanvas || !overlayCanvas) {
      // If no annotations were made, just proceed to next step
      onNext();
      return;
    }
    
    const finalCanvas = document.createElement('canvas');
    const ctx = finalCanvas.getContext('2d');
    
    finalCanvas.width = baseCanvas.width;
    finalCanvas.height = baseCanvas.height;
    
    // Draw base image
    ctx.drawImage(baseCanvas, 0, 0);
    // Draw annotations
    ctx.drawImage(overlayCanvas, 0, 0);
    
    const updatedDoc = {
      ...document,
      pages: document.pages.map((page, index) => 
        index === 0 ? { ...page, imageData: finalCanvas.toDataURL('image/jpeg', 0.8) } : page
      )
    };
    onDocumentUpdate(updatedDoc);
    onNext();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold">Markup Document</h1>
          </div>
          <button
            onClick={saveAnnotations}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            Next
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Canvas Area */}
        <div className="flex-1 p-4 flex items-center justify-center bg-gray-200 relative overflow-auto">
          <div className="relative inline-block">
            <canvas
              ref={canvasRef}
              className="block shadow-lg bg-white"
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                  clientX: touch.clientX,
                  clientY: touch.clientY
                });
                startDrawing(mouseEvent);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                  clientX: touch.clientX,
                  clientY: touch.clientY
                });
                draw(mouseEvent);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                stopDrawing();
              }}
            />
          </div>
        </div>

        {/* Tools Panel */}
        <div className="w-full lg:w-80 bg-white shadow-lg p-6 space-y-6">
          {/* Tools */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTool('pen')}
                className={`p-3 rounded-lg flex items-center justify-center gap-2 ${
                  tool === 'pen' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <PenTool size={20} />
                Pen
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-3 rounded-lg flex items-center justify-center gap-2 ${
                  tool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Eraser size={20} />
                Eraser
              </button>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Color</h3>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-12 rounded-lg border border-gray-300"
              />
              <div className="flex gap-2">
                {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded border-2 ${
                      color === c ? 'border-gray-600' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Brush Size */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Brush Size: {brushSize}px</h3>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Actions</h3>
            <button
              onClick={clearAnnotations}
              className="w-full bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// OCR Component
const OCR = ({ document, onDocumentUpdate, onNext, onBack }) => {
  const [ocrText, setOcrText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (document?.pages[0]?.ocrText) {
      setOcrText(document.pages[0].ocrText);
    }
    if (document?.pages[0]?.notes) {
      setNotes(document.pages[0].notes);
    }
  }, [document]);

  const performOCR = async () => {
    if (!document?.pages[0]?.imageData) return;
    
    setIsProcessing(true);
    
    try {
      // Simulate OCR processing (in real implementation, use Tesseract.js)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock OCR result
      const mockText = "This is a sample OCR result. In a real implementation, this would be the actual text extracted from the image using Tesseract.js or similar OCR library.";
      
      setOcrText(mockText);
      
      const updatedDoc = {
        ...document,
        pages: document.pages.map((page, index) => 
          index === 0 ? { ...page, ocrText: mockText } : page
        )
      };
      onDocumentUpdate(updatedDoc);
    } catch (error) {
      console.error('OCR Error:', error);
      alert('OCR processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveNotes = () => {
    const updatedDoc = {
      ...document,
      pages: document.pages.map((page, index) => 
        index === 0 ? { ...page, notes } : page
      )
    };
    onDocumentUpdate(updatedDoc);
  };

  const copyText = () => {
    navigator.clipboard.writeText(ocrText);
    alert('Text copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold">OCR & Notes</h1>
          </div>
          <button
            onClick={onNext}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            Next
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Image Preview */}
        <div className="w-full lg:w-1/2 p-4 bg-gray-200 flex items-center justify-center">
          {document?.pages[0]?.imageData && (
            <img
              src={document.pages[0].imageData}
              alt="Document"
              className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
            />
          )}
        </div>

        {/* OCR & Notes Panel */}
        <div className="w-full lg:w-1/2 bg-white p-6 space-y-6">
          {/* OCR Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Extracted Text</h3>
              <div className="flex gap-2">
                <button
                  onClick={performOCR}
                  disabled={isProcessing}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    isProcessing 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Type size={16} />
                  {isProcessing ? 'Processing...' : 'Extract Text'}
                </button>
                {ocrText && (
                  <button
                    onClick={copyText}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copy
                  </button>
                )}
              </div>
            </div>
            
            <div className="border border-gray-300 rounded-lg p-4 h-48 overflow-y-auto bg-gray-50">
              {isProcessing ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Processing image...</span>
                </div>
              ) : ocrText ? (
                <p className="text-gray-800 whitespace-pre-wrap">{ocrText}</p>
              ) : (
                <p className="text-gray-500 italic">Click "Extract Text" to process the document</p>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Add your notes about this document..."
              className="w-full h-32 border border-gray-300 rounded-lg p-4 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Document Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Document Info</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Pages: {document?.pages?.length || 0}</p>
              <p>Created: {document?.createdAt ? new Date(document.createdAt).toLocaleString() : 'Unknown'}</p>
              <p>Size: {document?.pages[0]?.imageData ? `${Math.round(document.pages[0].imageData.length / 1024)} KB` : 'Unknown'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export Component
const Export = ({ document, onSave, onBack }) => {
  const [exportFormat, setExportFormat] = useState('image');
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [quality, setQuality] = useState(80);

  const downloadImage = () => {
    if (!document?.pages[0]?.imageData) return;
    
    const link = document.createElement('a');
    link.download = `${document.name || 'document'}.jpg`;
    link.href = document.pages[0].imageData;
    link.click();
  };

  const downloadPDF = () => {
    // In a real implementation, you would use jsPDF or pdf-lib
    // For now, we'll simulate the PDF creation
    
    if (!document?.pages[0]?.imageData) return;
    
    // Mock PDF creation
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Set canvas size based on page format
      const dimensions = getPageDimensions(pageSize, orientation);
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      
      // Draw image to fit page
      const imgAspect = img.width / img.height;
      const pageAspect = canvas.width / canvas.height;
      
      let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
      
      if (imgAspect > pageAspect) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgAspect;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        drawHeight = canvas.height;
        drawWidth = canvas.height * imgAspect;
        offsetX = (canvas.width - drawWidth) / 2;
      }
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      
      // Convert to PDF blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${document.name || 'document'}.pdf`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/jpeg', quality / 100);
    };
    
    img.src = document.pages[0].imageData;
  };

  const getPageDimensions = (size, orient) => {
    const sizes = {
      'A4': { width: 595, height: 842 },
      'Letter': { width: 612, height: 792 },
      'Legal': { width: 612, height: 1008 }
    };
    
    const dims = sizes[size] || sizes.A4;
    return orient === 'landscape' 
      ? { width: dims.height, height: dims.width }
      : dims;
  };

  const shareDocument = async () => {
    if (navigator.share && document?.pages[0]?.imageData) {
      try {
        // Convert data URL to blob
        const response = await fetch(document.pages[0].imageData);
        const blob = await response.blob();
        const file = new File([blob], `${document.name || 'document'}.jpg`, { type: 'image/jpeg' });
        
        await navigator.share({
          title: document.name || 'Document',
          files: [file]
        });
      } catch (error) {
        console.error('Error sharing:', error);
        alert('Sharing not supported on this device');
      }
    } else {
      alert('Sharing not supported on this device');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-semibold">Export Document</h1>
          </div>
          <button
            onClick={onSave}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Save size={16} />
            Save & Finish
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Preview */}
        <div className="w-full lg:w-1/2 p-4 bg-gray-200 flex items-center justify-center">
          {document?.pages[0]?.imageData && (
            <div className="bg-white p-4 shadow-lg rounded-lg max-w-full max-h-full">
              <img
                src={document.pages[0].imageData}
                alt="Document preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Export Options */}
        <div className="w-full lg:w-1/2 bg-white p-6 space-y-6">
          {/* Format Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Export Format</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setExportFormat('image')}
                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 ${
                  exportFormat === 'image' 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileText size={24} />
                <span>Image (JPG)</span>
              </button>
              <button
                onClick={() => setExportFormat('pdf')}
                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 ${
                  exportFormat === 'pdf' 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileText size={24} />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* PDF Settings */}
          {exportFormat === 'pdf' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">PDF Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Page Size</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Orientation</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setOrientation('portrait')}
                      className={`flex-1 p-3 rounded-lg border ${
                        orientation === 'portrait' 
                          ? 'border-blue-600 bg-blue-50' 
                          : 'border-gray-300'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      onClick={() => setOrientation('landscape')}
                      className={`flex-1 p-3 rounded-lg border ${
                        orientation === 'landscape' 
                          ? 'border-blue-600 bg-blue-50' 
                          : 'border-gray-300'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quality Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quality: {quality}%</h3>
            <input
              type="range"
              min="10"
              max="100"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>Smaller file</span>
              <span>Better quality</span>
            </div>
          </div>

          {/* Document Name */}
          <div>
            <h3 className="text-lg font-semibold mb-4">File Name</h3>
            <input
              type="text"
              value={document?.name || ''}
              onChange={(e) => {
                const updatedDoc = { ...document, name: e.target.value };
                // In a real app, you'd call onDocumentUpdate here
              }}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Document name"
            />
          </div>

          {/* Export Actions */}
          <div className="space-y-3">
            <button
              onClick={exportFormat === 'pdf' ? downloadPDF : downloadImage}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg flex items-center justify-center gap-3 text-lg font-semibold"
            >
              <Download size={24} />
              Download {exportFormat === 'pdf' ? 'PDF' : 'Image'}
            </button>
            
            <button
              onClick={shareDocument}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-4 rounded-lg flex items-center justify-center gap-3 text-lg font-semibold"
            >
              <Share2 size={24} />
              Share Document
            </button>
          </div>

          {/* Document Stats */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Document Summary</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Name: {document?.name || 'Untitled'}</p>
              <p>Pages: {document?.pages?.length || 0}</p>
              <p>Format: {exportFormat.toUpperCase()}</p>
              <p>Quality: {quality}%</p>
              {document?.pages[0]?.ocrText && (
                <p>Text extracted: Yes</p>
              )}
              {document?.pages[0]?.notes && (
                <p>Notes added: Yes</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenScanXApp;