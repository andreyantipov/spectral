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

     in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.bun
            pkgs.zellij
            pkgs.helix
            pkgs.git
            pkgs.gh
            pkgs.lazygit
            pkgs.opentelemetry-collector-contrib
            otel-tui.defaultPackage.${system}
            pkgs.ast-grep
            pkgs.uv
            pkgs.tokei
            pkgs.fd
            pkgs.sd
            pkgs.delta
          ];
        };
      }
    );
}
