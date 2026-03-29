{
  description = "ctrl.page dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    otel-tui.url = "github:ymtdzzz/otel-tui";
  };

  outputs = { nixpkgs, flake-utils, otel-tui, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        tsgo = pkgs.buildGo126Module {
          pname = "tsgo";
          version = "unstable-2026-03-01";

          src = pkgs.fetchFromGitHub {
            owner = "microsoft";
            repo = "typescript-go";
            rev = "0a7d128ada55f48fdcf84296473d8b2f469605ff";
            hash = "sha256-WrRpZeQEkYvOw31DKdvX6iksNP/dsO2Ol5vwUw5IA64=";
          };

          vendorHash = "sha256-dUO6rCw8BrIJ+igFrntTIro4k1PH69G2J1IWPKsGzfM=";

          subPackages = [ "cmd/tsgo" ];
        };

     in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.bun
            tsgo
            pkgs.zellij
            pkgs.helix
            pkgs.git
            pkgs.gh
            pkgs.lazygit
            pkgs.opentelemetry-collector-contrib
            otel-tui.defaultPackage.${system}
            pkgs.ast-grep
            pkgs.uv
          ];
        };
      }
    );
}
