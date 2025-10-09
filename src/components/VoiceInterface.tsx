import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { AudioRecorder, encodeAudioForAPI, playAudioData, clearAudioQueue } from '@/utils/RealtimeAudio';

interface VoiceInterfaceProps {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSpeakingChange?: (speaking: boolean) => void;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onTranscript, onSpeakingChange }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startConversation = async () => {
    setIsConnecting(true);
    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });

      // Connect to WebSocket
      const wsUrl = `wss://wwajmaohwcbooljdureo.supabase.co/functions/v1/apex-voice`;
      console.log('Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);

        // Start recording
        recorderRef.current = new AudioRecorder((audioData) => {
          if (ws.readyState === WebSocket.OPEN) {
            const encoded = encodeAudioForAPI(audioData);
            ws.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: encoded
            }));
          }
        });
        
        await recorderRef.current.start();
        console.log('Recording started');

        toast({
          title: 'Voice Active',
          description: 'APEX is listening...',
        });
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received event:', data.type);

          if (data.type === 'response.audio.delta' && audioContextRef.current) {
            const binaryString = atob(data.delta);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            await playAudioData(audioContextRef.current, bytes);
          } else if (data.type === 'response.audio_transcript.delta') {
            onTranscript?.(data.delta, false);
          } else if (data.type === 'response.audio_transcript.done') {
            onTranscript?.(data.transcript, true);
          } else if (data.type === 'input_audio_buffer.speech_started') {
            console.log('User started speaking');
          } else if (data.type === 'input_audio_buffer.speech_stopped') {
            console.log('User stopped speaking');
          } else if (data.type === 'response.audio.done') {
            onSpeakingChange?.(false);
          } else if (data.type === 'response.created') {
            onSpeakingChange?.(true);
          } else if (data.type === 'error') {
            console.error('Received error:', data.error);
            toast({
              title: 'Error',
              description: data.error.message || 'An error occurred',
              variant: 'destructive',
            });
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnecting(false);
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to voice service',
          variant: 'destructive',
        });
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setIsConnecting(false);
        endConversation();
      };
    } catch (error) {
      console.error('Error starting conversation:', error);
      setIsConnecting(false);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start voice conversation',
        variant: 'destructive',
      });
    }
  };

  const endConversation = () => {
    recorderRef.current?.stop();
    wsRef.current?.close();
    audioContextRef.current?.close();
    clearAudioQueue();
    
    recorderRef.current = null;
    wsRef.current = null;
    audioContextRef.current = null;
    
    setIsConnected(false);
    onSpeakingChange?.(false);
  };

  useEffect(() => {
    return () => {
      endConversation();
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {!isConnected ? (
        <Button 
          onClick={startConversation}
          disabled={isConnecting}
          variant="default"
          size="lg"
          className="gap-2"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Mic className="h-5 w-5" />
              Start Voice Chat
            </>
          )}
        </Button>
      ) : (
        <Button 
          onClick={endConversation}
          variant="destructive"
          size="lg"
          className="gap-2"
        >
          <MicOff className="h-5 w-5" />
          End Voice Chat
        </Button>
      )}
    </div>
  );
};

export default VoiceInterface;
