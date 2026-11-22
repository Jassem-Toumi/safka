// Generates short browser-playable H.264 MP4s for the seeded draft videos (no external assets).
// Usage: swift scripts/make-seed-mp4.swift <out.mp4> "<label>" <r> <g> <b>
import AVFoundation
import CoreGraphics
import CoreText
import Foundation

let args = CommandLine.arguments
guard args.count == 6 else { print("usage: out label r g b"); exit(1) }
let out = URL(fileURLWithPath: args[1])
let label = args[2]
let (r, g, b) = (CGFloat(Double(args[3])!), CGFloat(Double(args[4])!), CGFloat(Double(args[5])!))
let w = 640, h = 360, fps: Int32 = 24, seconds = 6
try? FileManager.default.removeItem(at: out)

let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 400_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264BaselineAutoLevel],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
])
writer.add(input)
writer.shouldOptimizeForNetworkUse = true // moov atom first, so browsers can seek immediately
writer.startWriting()
writer.startSession(atSourceTime: .zero)

func drawText(_ ctx: CGContext, _ text: String, size: CGFloat, y: CGFloat) {
  let font = CTFontCreateWithName("Helvetica-Bold" as CFString, size, nil)
  let attr = NSAttributedString(string: text, attributes: [kCTFontAttributeName as NSAttributedString.Key: font, kCTForegroundColorAttributeName as NSAttributedString.Key: CGColor(red: 1, green: 1, blue: 1, alpha: 1)])
  let line = CTLineCreateWithAttributedString(attr)
  let bounds = CTLineGetBoundsWithOptions(line, .useOpticalBounds)
  ctx.textPosition = CGPoint(x: (CGFloat(w) - bounds.width) / 2, y: y)
  CTLineDraw(line, ctx)
}

let total = Int(fps) * seconds
for i in 0..<total {
  while !input.isReadyForMoreMediaData { usleep(1000) }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  let buf = pb!
  CVPixelBufferLockBaseAddress(buf, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: w, height: h, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf),
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.setFillColor(CGColor(red: r, green: g, blue: b, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  // Progress bar so seeking is visible.
  let p = CGFloat(i) / CGFloat(total - 1)
  ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.85))
  ctx.fill(CGRect(x: 40, y: 40, width: (CGFloat(w) - 80) * p, height: 10))
  drawText(ctx, label, size: 44, y: 190)
  drawText(ctx, "Sample draft video · \(String(format: "%.1f", Double(i) / Double(fps)))s", size: 22, y: 140)
  CVPixelBufferUnlockBaseAddress(buf, [])
  adaptor.append(buf, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed { print("failed: \(String(describing: writer.error))"); exit(1) }
print("wrote \(out.path)")
