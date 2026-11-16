import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const catalog = JSON.parse(await readFile(new URL('../docs/features.json', import.meta.url), 'utf8'));
const categories = new Map(catalog.categories.map(item => [item.id, item.title]));
const phases = { M0: '핵심 셀 조작', M1: '업무 적용', M2: '고급 그리드', M3: '특수 기능', LATER: '독립 확장 후보' };
const statuses = { implemented: '초기 구현', partial: '일부 구현', planned: '계획' };
const evidence = { 'body-reviewed': '본문 검토', 'index-listed': '목차 확인', proposal: '자체 요구' };
const ids = new Set();
for (const feature of catalog.features) {
  assert(!ids.has(feature.id), `Duplicate ID: ${feature.id}`); ids.add(feature.id);
  assert.match(feature.id, new RegExp(`^${feature.category}-\\d{3}$`));
  assert(categories.has(feature.category)); assert(feature.phase in phases); assert(feature.status in statuses); assert(feature.evidence in evidence);
  assert(feature.acceptance && feature.name);
  if (feature.evidence === 'proposal') assert.equal(feature.sources.length, 0);
  else assert(feature.sources.length > 0);
  for (const source of feature.sources) assert.equal(new URL(source).hostname, 'docs.realgrid.com');
}
const count = key => Object.fromEntries(Object.keys(key === 'phase' ? phases : statuses).map(value => [value, catalog.features.filter(item => item[key] === value).length]));
const lines = ['# RealGrid 참고 기능 카탈로그', '', `확인일: ${catalog.checkedAt} · 참고 릴리스: RealGrid2 ${catalog.baseline.release} (${catalog.baseline.releaseDate}) · 총 ${catalog.features.length}개 후보`, '',
  catalog.baseline.coverage, '',
  '무료·폐쇄망용 독립 구현의 개발 후보다. 완료 판정은 **MOUM가 채택한 요구사항**이며 RealGrid의 모든 동작을 보증하는 문장이 아니다. 초기 구현은 소스 존재 상태로, 전체 브라우저·IME·스크린리더 검증 완료를 의미하지 않는다.', '',
  '근거 구분: **본문 검토**는 주요 설명을 확인한 항목, **목차 확인**은 공식 기능 항목의 존재를 확인한 1차 후보, **자체 요구**는 사용자 요구 또는 MOUM 설계 제안이다. 목차 확인 항목은 착수 시 상세 API·제한사항을 추가 검토한다.', '',
  '우선순위와 단계는 개발 제안이며 일정 약속이 아니다. 관련 제품 연동 후보는 Grid 기능 완성도 계산에서 제외한다.', '',
  '| 단계 | 의미 | 항목 수 |', '| --- | --- | ---: |', ...Object.entries(count('phase')).map(([key, value]) => `| ${key} | ${phases[key]} | ${value} |`), '',
  '| 상태 | 항목 수 |', '| --- | ---: |', ...Object.entries(count('status')).map(([key, value]) => `| ${statuses[key]} | ${value} |`), '',
  '중요한 구분과 구현 순서는 [로드맵](roadmap.md), 사용자 지정 단축키는 [셀 조작 계약](grid-interaction-contract.md)을 참고한다.', ''];
for (const [category, title] of categories) {
  lines.push(`## ${title}`, '', '| ID | 기능 | 단계 | 상태 | 완료 판정 | 근거 |', '| --- | --- | --- | --- | --- | --- |');
  for (const item of catalog.features.filter(item => item.category === category)) {
    const source = item.sources.length ? `[${evidence[item.evidence]}](${item.sources[0]})` : evidence[item.evidence];
    lines.push(`| ${item.id} | ${item.name} | ${item.phase} | ${statuses[item.status]} | ${item.acceptance} | ${source} |`);
  }
  lines.push('');
}
lines.push('## 원본 자료와 유지 방법', '',
  '- [공식 가이드](https://docs.realgrid.com/)와 각 행의 직접 링크를 기준으로 분류했다. 예전 [RealGridJS 데모](https://demo.realgrid.com/)는 별도 버전 자료이므로 현재 기능의 증거로 혼용하지 않았다.',
  '- [공식 버전 기록](https://docs.realgrid.com/changelog/releases)을 확인했다. 사용자의 실제 적용 버전과 빌드는 아직 확인되지 않았다.',
  '- `docs/features.json`이 원본이다. 수정 후 `npm run catalog`로 이 문서를 갱신한다. `npm run catalog -- --check`로 ID·분류·근거와 생성 문서의 일치 여부를 확인한다.',
  '- 공식 구현 코드·라이선스 파일·상표 리소스를 복사하지 않았다. 이 카탈로그의 라이선스는 참조 제품의 코드나 문서에 권리를 부여하지 않는다.', '');
const output = lines.join('\n');
const target = new URL('../docs/feature-catalog.md', import.meta.url);
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), output, 'Run npm run catalog to refresh documentation');
else await writeFile(target, output);
console.log(JSON.stringify({ total: catalog.features.length, phases: count('phase'), statuses: count('status') }));
