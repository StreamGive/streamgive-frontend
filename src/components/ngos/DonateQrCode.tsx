'use client';

import { useRef, useSyncExternalStore } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

import { APP_URL } from '@/lib/config';

// Same pattern as EmbedSnippet: the origin is read from the browser once
// hydrated, with APP_URL only as the server-render fallback, so there is no
// environment variable to get wrong per-deployment and no hydration
// mismatch from reading `window` during the initial render.
const noopSubscribe = () => () => {};

const QR_DISPLAY_SIZE_PX = 180;
// The canvas is rendered at this pixel size and only scaled down for
// on-page display (via CSS, below) — the "Download" link exports the same
// canvas at its native resolution, which needs to be print-sized, not
// screen-sized.
const QR_EXPORT_SIZE_PX = 512;

/**
 * Renders a QR code pointing at an NGO's donate page, for offline/in-person
 * sharing (#165). Includes a "Download" link that exports the rendered
 * canvas as a PNG, since a QR code meant for print needs to leave the page.
 */
export function DonateQrCode({ ngoId, ngoName }: { ngoId: string; ngoName: string }) {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => APP_URL,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const donateUrl = `${origin}/ngos/${ngoId}/donate`;

  function handleDownload(): void {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${ngoName.replace(/\s+/g, '-').toLowerCase()}-donate-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="inline-flex flex-col items-center gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <QRCodeCanvas
        ref={canvasRef}
        value={donateUrl}
        size={QR_EXPORT_SIZE_PX}
        level="H"
        marginSize={2}
        style={{ width: QR_DISPLAY_SIZE_PX, height: QR_DISPLAY_SIZE_PX }}
        role="img"
        aria-label={`QR code linking to ${ngoName}'s donate page`}
      />
      <p className="max-w-[180px] break-all text-center text-xs text-gray-500 dark:text-gray-400">
        {donateUrl}
      </p>
      <button
        type="button"
        onClick={handleDownload}
        className="text-sm font-medium text-black underline dark:text-white"
      >
        Download
      </button>
    </div>
  );
}
