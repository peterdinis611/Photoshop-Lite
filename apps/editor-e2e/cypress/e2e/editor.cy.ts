describe('Photoshop Lite editor', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('loads the darkroom shell with brand and menus', () => {
    cy.contains('Photoshop').should('be.visible');
    cy.contains('button', 'File').should('be.visible');
    cy.contains('button', 'Image').should('be.visible');
    cy.contains('button', 'Layer').should('be.visible');
    cy.contains('button', 'Filter').should('be.visible');
    cy.contains('button', 'Export').should('be.visible');
  });

  it('shows canvas tools and demo sample on empty start', () => {
    cy.get('canvas').should('exist');
    // Demo sample auto-loads when layers empty
    cy.contains(/Portrait|Demo|Untitled/i, { timeout: 15000 }).should('exist');
  });

  it('opens File menu and lists Place / Save / Export', () => {
    cy.contains('button', 'File').click();
    cy.contains('Place Image').should('be.visible');
    cy.contains('Save Project').should('be.visible');
    cy.contains('Export As').should('be.visible');
  });

  it('opens Filter menu with Photo Revive and Cleanup', () => {
    cy.contains('button', 'Filter').click();
    cy.contains('Photo Revive').should('be.visible');
    cy.contains('Photo Cleanup').should('be.visible');
    cy.contains('Remove Background').should('be.visible');
  });

  it('can open Export modal and cancel', () => {
    cy.contains('button', 'Export').click();
    cy.contains('Export Artwork').should('be.visible');
    cy.contains('button', 'Cancel').click();
    cy.contains('Export Artwork').should('not.exist');
  });

  it('switches right sidebar tabs', () => {
    cy.contains('button', 'Lab').click({ force: true });
    cy.contains(/Photo Revive|Photo Cleanup|Neural Lab/i, { timeout: 8000 }).should('be.visible');
    cy.contains('button', 'Tone').click({ force: true });
    cy.contains(/Photo Revive|Photo Cleanup|Presets|Manual/i).should('be.visible');
  });

  it('runs Revive from the action dock without crashing', () => {
    cy.contains('button', 'Revive').click({ force: true });
    // Either processing toast or success — UI must remain usable
    cy.contains('button', 'Export', { timeout: 20000 }).should('be.visible');
  });

  it('runs Clean from the action dock without crashing', () => {
    cy.contains('button', 'Clean').click({ force: true });
    cy.contains('button', 'Export', { timeout: 20000 }).should('be.visible');
  });
});
