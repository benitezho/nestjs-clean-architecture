/** Architecture rules, enforced by `pnpm check:architecture` (and CI). */
const MODULE = '^src/modules/([^/]+)';
const KERNEL = '^src/shared/kernel';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment:
        'domain/ may only import other files of its own domain/, the shared kernel and Node ' +
        'core modules. No frameworks, ORMs, other layers or other shared code.',
      severity: 'error',
      from: { path: `${MODULE}/domain` },
      to: {
        pathNot: [`^src/modules/$1/domain`, KERNEL],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'application-depends-on-domain-only',
      comment:
        'application/ may only import its own domain/ and application/ (ports, use cases) and ' +
        'the shared kernel. Adapters are wired from outside.',
      severity: 'error',
      from: { path: `${MODULE}/application` },
      to: {
        pathNot: [`^src/modules/$1/(domain|application)`, KERNEL],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'interface-does-not-reach-infrastructure',
      comment: 'Controllers talk to use cases, never to adapters.',
      severity: 'error',
      from: { path: `${MODULE}/interface` },
      to: { path: `^src/modules/$1/infrastructure` },
    },
    {
      name: 'kernel-is-self-contained',
      comment: 'shared/kernel is pure TypeScript and imports nothing outside itself.',
      severity: 'error',
      from: { path: KERNEL },
      to: {
        pathNot: [KERNEL],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'shared-does-not-depend-on-modules',
      comment: 'shared/ is a dependency of feature modules, never the other way around.',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/modules' },
    },
    {
      name: 'no-circular',
      comment: 'Bidirectional TypeORM relations are inherently circular, so entities are exempt.',
      severity: 'error',
      from: { pathNot: '\\.entity\\.ts$' },
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '\\.spec\\.ts$' },
  },
};
