'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface WebRTCConfig {
  domain: string;
  username: string;
  password: string;
  displayName?: string;
}

interface RecentCall {
  number: string;
  status: string;
  duration: number;
  timestamp: Date;
}

export function useWebRTC(config: WebRTCConfig | null) {
  // Connection states
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [webrtcRegistered, setWebrtcRegistered] = useState(false);
  const [webrtcConnecting, setWebrtcConnecting] = useState(false);
  
  // Call states
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const [callTarget, setCallTarget] = useState('');
  const [callTargetNumber, setCallTargetNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Recent calls
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  
  // Refs for WebRTC objects
  const webrtcUA = useRef<any>(null);
  const webrtcSession = useRef<any>(null);
  const callTimer = useRef<NodeJS.Timeout | null>(null);

  // Format call duration
  const formatCallDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Start call timer
  const startCallTimer = useCallback(() => {
    if (callTimer.current) {
      clearInterval(callTimer.current);
    }
    
    setCallDuration(0);
    callTimer.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  // Stop call timer
  const stopCallTimer = useCallback(() => {
    if (callTimer.current) {
      clearInterval(callTimer.current);
      callTimer.current = null;
    }
  }, []);

  // Connect to WebRTC
  const connectWebRTC = useCallback(async () => {
    if (!config || webrtcConnecting) return;

    setWebrtcConnecting(true);
    
    try {
      // Dynamic import of JsSIP
      const JsSIP = (window as any).JsSIP;
      if (!JsSIP) {
        throw new Error('JsSIP library not loaded');
      }

      const socket = new JsSIP.WebSocketInterface(`wss://${config.domain}:8089/ws`);
      const configuration = {
        sockets: [socket],
        uri: `sip:${config.username}@${config.domain}`,
        password: config.password,
        display_name: config.displayName || config.username,
        register: true,
        session_timers: false,
        connection_recovery_min_interval: 2,
        connection_recovery_max_interval: 30,
        register_expires: 600,
        no_answer_timeout: 60,
        use_preloaded_route: false
      };

      const ua = new JsSIP.UA(configuration);
      webrtcUA.current = ua;

      // Event listeners
      ua.on('connecting', () => {
        console.log('WebRTC: Connecting...');
        setWebrtcConnected(false);
        setWebrtcRegistered(false);
      });

      ua.on('connected', () => {
        console.log('WebRTC: Connected');
        setWebrtcConnected(true);
      });

      ua.on('disconnected', () => {
        console.log('WebRTC: Disconnected');
        setWebrtcConnected(false);
        setWebrtcRegistered(false);
      });

      ua.on('registered', () => {
        console.log('WebRTC: Registered');
        setWebrtcRegistered(true);
      });

      ua.on('unregistered', () => {
        console.log('WebRTC: Unregistered');
        setWebrtcRegistered(false);
      });

      ua.on('registrationFailed', (e: any) => {
        console.error('WebRTC: Registration failed', e);
        setWebrtcRegistered(false);
      });

      ua.on('newRTCSession', (e: any) => {
        const session = e.session;
        webrtcSession.current = session;

        if (session.direction === 'incoming') {
          // Handle incoming call
          setCallStatus('ringing');
          setCallTarget('Chamada Recebida');
          setCallTargetNumber(session.remote_identity.uri.user);
        }

        session.on('connecting', () => {
          console.log('Call connecting...');
          setCallStatus('calling');
        });

        session.on('progress', () => {
          console.log('Call progress...');
          setCallStatus('ringing');
        });

        session.on('accepted', () => {
          console.log('Call accepted');
          setCallStatus('connected');
          startCallTimer();
        });

        session.on('ended', () => {
          console.log('Call ended');
          handleCallEnd();
        });

        session.on('failed', () => {
          console.log('Call failed');
          handleCallEnd();
        });
      });

      ua.start();

    } catch (error) {
      console.error('WebRTC connection error:', error);
      setWebrtcConnected(false);
      setWebrtcRegistered(false);
    } finally {
      setWebrtcConnecting(false);
    }
  }, [config, webrtcConnecting, startCallTimer]);

  // Disconnect WebRTC
  const disconnectWebRTC = useCallback(() => {
    if (webrtcUA.current) {
      webrtcUA.current.stop();
      webrtcUA.current = null;
    }
    
    if (webrtcSession.current) {
      webrtcSession.current = null;
    }

    stopCallTimer();
    setWebrtcConnected(false);
    setWebrtcRegistered(false);
    setCallStatus('idle');
    setCallTarget('');
    setCallTargetNumber('');
    setCallDuration(0);
    setIsMuted(false);
  }, [stopCallTimer]);

  // Make WebRTC call
  const makeWebRTCCall = useCallback((number: string) => {
    if (!webrtcUA.current || !webrtcRegistered || !number.trim()) {
      return false;
    }

    try {
      const target = `sip:${number}@${config?.domain}`;
      const options = {
        mediaConstraints: { audio: true, video: false },
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false }
      };

      const session = webrtcUA.current.call(target, options);
      webrtcSession.current = session;

      setCallStatus('calling');
      setCallTarget(number);
      setCallTargetNumber(number);

      return true;
    } catch (error) {
      console.error('Error making WebRTC call:', error);
      return false;
    }
  }, [webrtcRegistered, config?.domain]);

  // Hangup WebRTC call
  const hangupWebRTCCall = useCallback(() => {
    if (webrtcSession.current) {
      try {
        webrtcSession.current.terminate();
      } catch (error) {
        console.error('Error hanging up call:', error);
      }
    }
    handleCallEnd();
  }, []);

  // Handle call end
  const handleCallEnd = useCallback(() => {
    const endTime = new Date();
    const duration = callDuration;

    // Add to recent calls
    if (callTarget && callTargetNumber) {
      const newCall: RecentCall = {
        number: callTargetNumber,
        status: duration > 0 ? 'Conectado' : 'Falhou',
        duration,
        timestamp: endTime
      };

      setRecentCalls(prev => [newCall, ...prev.slice(0, 9)]); // Keep last 10 calls
    }

    stopCallTimer();
    setCallStatus('idle');
    setCallTarget('');
    setCallTargetNumber('');
    setCallDuration(0);
    setIsMuted(false);
    webrtcSession.current = null;
  }, [callTarget, callTargetNumber, callDuration, stopCallTimer]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (webrtcSession.current && callStatus === 'connected') {
      try {
        if (isMuted) {
          webrtcSession.current.unmute();
        } else {
          webrtcSession.current.mute();
        }
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    }
  }, [isMuted, callStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebRTC();
    };
  }, [disconnectWebRTC]);

  return {
    // Connection state
    webrtcConnected,
    webrtcRegistered,
    webrtcConnecting,
    
    // Call state
    callStatus,
    callTarget,
    callTargetNumber,
    callDuration,
    isMuted,
    
    // Recent calls
    recentCalls,
    
    // Actions
    connectWebRTC,
    disconnectWebRTC,
    makeWebRTCCall,
    hangupWebRTCCall,
    toggleMute,
    formatCallDuration
  };
}
