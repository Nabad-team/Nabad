# Diagrams

Sequence and activity diagrams of Nabad's main flows, written in Mermaid (GitHub renders them) and accurate to the code at the time of writing. When a flow changes, update its diagram in the same pull request.

| Diagram | PNG |
| --- | --- |
| [AI symptom check](./ai-symptom-check.md) | [ai-symptom-check.png](./png/ai-symptom-check.png) |
| [Sign-in with password and 2FA](./login-2fa.md) | [login-2fa.png](./png/login-2fa.png) |
| [Care circle: invite, accept and alert](./care-circle.md) | [care-circle.png](./png/care-circle.png) |
| [Activity diagram: symptom triage and care navigation](./triage-activity.md) | [triage-activity.png](./png/triage-activity.png) |
| [Architecture](../architecture.md): production, local development, AI triage design | [architecture-production.png](./png/architecture-production.png), [architecture-local.png](./png/architecture-local.png), [architecture-ai-triage.png](./png/architecture-ai-triage.png) |

## The PNGs

The PNGs are for slides: white background, large text. They were rendered from the Mermaid blocks with [mermaid-cli](https://github.com/mermaid-js/mermaid-cli) 11.4.2, for example:

```sh
npx -y @mermaid-js/mermaid-cli@11.4.2 -i diagram.mmd -o png/diagram.png -b white -s 1.5 -w 4000 -c config.json
```

with `config.json` setting the `base` theme and font sizes of 24 to 26 px (`themeVariables.fontSize`, `sequence.messageFontSize`, `sequence.actorFontSize`). Re-render a PNG whenever its diagram changes.
