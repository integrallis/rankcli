// Source of rankcli-apple-ai, the helper that runs a prompt on Apple's on-device model. The
// Foundation Models framework is Swift-only, so apple-ai.ts compiles this with the Xcode
// command-line tools on first use and caches the binary (keyed by a hash of this text).
// CI compiles it on a macOS runner (native-release.yml) so a framework API change fails there.
//
//   rankcli-apple-ai --check   ->  {"available":true} | {"available":false,"reason":"..."}
//   rankcli-apple-ai < {"system":"...","prompt":"...","maxTokens":1200}
//                              ->  {"text":"..."} | {"error":"..."}
export const APPLE_AI_SWIFT_SOURCE = String.raw`import Foundation
import FoundationModels

func reply(_ object: [String: Any], code: Int32 = 0) -> Never {
    let data = (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{\"error\":\"could not encode the reply\"}".utf8)
    FileHandle.standardOutput.write(data)
    exit(code)
}

let model = SystemLanguageModel.default

if CommandLine.arguments.contains("--check") {
    switch model.availability {
    case .available:
        reply(["available": true])
    case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible: reply(["available": false, "reason": "deviceNotEligible"])
        case .appleIntelligenceNotEnabled: reply(["available": false, "reason": "appleIntelligenceNotEnabled"])
        case .modelNotReady: reply(["available": false, "reason": "modelNotReady"])
        @unknown default: reply(["available": false, "reason": "unavailable"])
        }
    @unknown default:
        reply(["available": false, "reason": "unavailable"])
    }
}

struct Request: Decodable {
    let system: String?
    let prompt: String
    let maxTokens: Int?
}

let input = FileHandle.standardInput.readDataToEndOfFile()
guard let request = try? JSONDecoder().decode(Request.self, from: input) else {
    reply(["error": "expected a JSON request on stdin"], code: 2)
}

let session: LanguageModelSession
if let system = request.system {
    session = LanguageModelSession(instructions: system)
} else {
    session = LanguageModelSession()
}

do {
    let response = try await session.respond(
        to: request.prompt,
        options: GenerationOptions(maximumResponseTokens: request.maxTokens)
    )
    reply(["text": response.content])
} catch let error as LanguageModelSession.GenerationError {
    switch error {
    case .exceededContextWindowSize:
        reply(["error": "the prompt is too long for the on-device model"], code: 1)
    case .guardrailViolation:
        reply(["error": "the on-device model's guardrails declined the request"], code: 1)
    case .assetsUnavailable:
        reply(["error": "the on-device model isn't downloaded yet"], code: 1)
    default:
        reply(["error": String(describing: error)], code: 1)
    }
} catch {
    reply(["error": String(describing: error)], code: 1)
}
`;
