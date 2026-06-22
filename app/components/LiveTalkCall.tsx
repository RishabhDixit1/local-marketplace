"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

type Props = {
  conversationId: string;
  userId: string;
  otherUserId: string;
  requestId: string;
  onEnd: () => void;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function LiveTalkCall({ conversationId, userId, otherUserId, onEnd }: Props) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const madeOfferRef = useRef(false);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
  }, [localStream]);

  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (event) => {
          if (event.streams[0]) {
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            setError("Call disconnected.");
            cleanup();
          }
        };

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          channelRef.current?.send({
            type: "broadcast",
            event: "webrtc_ice",
            payload: { candidate: event.candidate.toJSON(), senderId: userId },
          });
        };

        // Signaling via Realtime broadcast
        const channel = supabase.channel(`webrtc-${conversationId}`);
        channelRef.current = channel;

        channel.on("broadcast", { event: "webrtc_offer" }, async ({ payload }) => {
          if (payload.senderId === userId || pc.signalingState !== "stable") return;
          madeOfferRef.current = false;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "webrtc_answer",
            payload: { sdp: pc.localDescription, senderId: userId },
          });
        });

        channel.on("broadcast", { event: "webrtc_answer" }, async ({ payload }) => {
          if (payload.senderId === userId || pc.signalingState !== "have-local-offer") return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        });

        channel.on("broadcast", { event: "webrtc_ice" }, async ({ payload }) => {
          if (payload.senderId === userId) return;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {
            // Ignore stale candidates
          }
        });

        channel.subscribe(async (status) => {
          if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
            console.warn(`[LiveTalk] Signaling channel ${status} — WebRTC connection may fail`);
          }
          if (status !== "SUBSCRIBED") return;

          // Brief wait to ensure other party is also subscribed
          await new Promise((r) => setTimeout(r, 800));

          // Decide who makes the offer: higher userId makes the offer
          if (userId > otherUserId && !madeOfferRef.current) {
            madeOfferRef.current = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: "broadcast",
              event: "webrtc_offer",
              payload: { sdp: pc.localDescription, senderId: userId },
            });
          }
        });

        setConnecting(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not access camera/mic.");
        setConnecting(false);
      }
    };

    void start();

    return () => {
      cleanup();
      channelRef.current?.unsubscribe();
      supabase.removeChannel(channelRef.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, userId, otherUserId]);

  const toggleMute = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted(!muted);
  };

  const toggleVideo = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => { t.enabled = videoOff; });
    setVideoOff(!videoOff);
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
        <div className="rounded-3xl bg-white p-8 text-center shadow-2xl max-w-sm">
          <p className="font-semibold text-rose-600">Call error</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button onClick={onEnd} className="mt-6 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
        <div className="rounded-3xl bg-white p-8 text-center shadow-2xl">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-4 text-sm font-medium text-slate-700">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950">
      {/* Remote video */}
      <div className="relative flex-1 bg-black">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`h-full w-full object-contain ${remoteStream ? "" : "hidden"}`}
        />
        {!remoteStream && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-20 w-20 rounded-full bg-slate-800" />
              <p className="mt-4 text-lg font-semibold text-white">Waiting for other user...</p>
              <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-slate-400" />
            </div>
          </div>
        )}
      </div>

      {/* Local video (picture-in-picture) */}
      <div className="absolute right-4 top-4 z-10 overflow-hidden rounded-2xl border-2 border-white/30 shadow-lg">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`h-28 w-20 object-cover sm:h-36 sm:w-28 ${localStream ? "" : "hidden"}`}
        />
        {!localStream && (
          <div className="flex h-28 w-20 items-center justify-center bg-slate-800 text-xs text-slate-500">
            No camera
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 px-6 py-8">
        <button
          type="button"
          onClick={toggleMute}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
            muted ? "bg-rose-600 text-white" : "bg-white/15 text-white hover:bg-white/25"
          }`}
        >
          {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        <button
          type="button"
          onClick={() => { cleanup(); onEnd(); }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500"
        >
          <PhoneOff className="h-7 w-7" />
        </button>

        <button
          type="button"
          onClick={toggleVideo}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
            videoOff ? "bg-rose-600 text-white" : "bg-white/15 text-white hover:bg-white/25"
          }`}
        >
          {videoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}
