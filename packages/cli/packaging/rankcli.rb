class Rankcli < Formula
  desc "Ship code, get ranked - SEO/GEO audits for CI/CD"
  homepage "https://rankcli.dev"
  version "${VERSION}"
  license "MIT"

  on_macos do
    on_arm do
      url "${BASE}/rankcli-macos-aarch64"
      sha256 "${SHA_MAC_ARM}"
    end
    on_intel do
      url "${BASE}/rankcli-macos-x86_64"
      sha256 "${SHA_MAC_X64}"
    end
  end

  on_linux do
    on_arm do
      url "${BASE}/rankcli-linux-aarch64"
      sha256 "${SHA_LINUX_ARM}"
    end
    on_intel do
      url "${BASE}/rankcli-linux-x86_64"
      sha256 "${SHA_LINUX_X64}"
    end
  end

  def install
    bin.install Dir["rankcli-*"].first => "rankcli"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/rankcli --version")
    assert_match "audit", shell_output("#{bin}/rankcli --help")
  end
end
