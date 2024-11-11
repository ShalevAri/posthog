import { decideResponse } from '../fixtures/api/decide'

describe('Feature Flags', () => {
    let name

    beforeEach(() => {
        cy.intercept('**/decide/*', (req) => req.reply(decideResponse({})))

        cy.intercept('/api/projects/*/property_definitions?type=person*', {
            fixture: 'api/feature-flags/property_definition',
        })
        cy.intercept('/api/person/values?*', {
            fixture: 'api/feature-flags/property_values',
        })
        name = 'feature-flag-' + Math.floor(Math.random() * 10000000)
        cy.visit('/feature_flags')
    })

    it('Create feature flag', () => {
        // ensure unique names to avoid clashes
        cy.get('[data-attr=top-bar-name]').should('contain', 'Feature flags')
        cy.get('[data-attr=new-feature-flag]').click()
        cy.get('[data-attr=feature-flag-key]').click().type(`{moveToEnd}${name}`).should('have.value', name)
        cy.get('[data-attr=feature-flag-description]')
            .type('This is a new feature.')
            .should('have.value', 'This is a new feature.')

        // Check that feature flags instructions can be displayed in another code language
        cy.get('[data-attr=feature-flag-instructions-select]').click()
        // force click rather than scrolling the element into view
        cy.get('[data-attr=feature-flag-instructions-select-option-php]').click({ force: true })
        cy.get('[data-attr=feature-flag-instructions-snippet]').should(
            'contain',
            /if (PostHog::isFeatureEnabled('.*', 'some distinct id')) {/
        )
        cy.get('[data-attr=feature-flag-instructions-snippet]').should('contain', / {4}\/\/ do something here/)
        cy.get('[data-attr=feature-flag-instructions-snippet]').should('contain', /}/)
        cy.get('[data-attr=feature-flag-doc-link]').should(
            'have.attr',
            'href',
            'https://posthog.com/docs/libraries/php?utm_medium=in-product&utm_campaign=feature-flag#feature-flags'
        )

        // select "add filter" and "property"
        cy.get('[data-attr=property-select-toggle-0').click()

        // select the first property
        cy.get('[data-attr=taxonomic-filter-searchfield]').click()
        cy.get('[data-attr=taxonomic-filter-searchfield]').type('is_demo')
        cy.get('[data-attr=taxonomic-tab-person_properties]').click()
        cy.get('[data-attr=prop-filter-person_properties-0]').click({ force: true })

        // selects the first value
        cy.get('[data-attr=prop-val]').click()
        cy.get('[data-attr=prop-val-0]').click({ force: true })

        // set rollout percentage
        cy.get('[data-attr=rollout-percentage]').clear().type('0').should('have.value', '0')

        // save the feature flag
        cy.get('[data-attr=save-feature-flag]').first().click()

        // after save there should be a delete button
        cy.get('[data-attr="more-button"]').click()
        cy.get('button[data-attr="delete-feature-flag"]').should('have.text', 'Delete feature flag')

        // make sure the data is there as expected after a page reload!
        cy.reload()

        // click the sidebar item to go back to the list
        cy.clickNavMenu('featureflags')
        cy.get('[data-attr=feature-flag-table]').should('contain', name)
        cy.get('[data-attr=feature-flag-table]').should('contain', 'No users') // By default it's released to nobody, if a % is not specified

        cy.get(`[data-row-key=${name}]`).contains(name).click()
        cy.get(`[data-attr=edit-feature-flag]`).click()
        cy.get('[data-attr=feature-flag-key]')
            .click()
            .type(`{moveToEnd}-updated`)
            .should('have.value', name + '-updated')
        cy.get('[data-attr=rollout-percentage]').type('{selectall}50').should('have.value', '50')
        cy.get('[data-attr=save-feature-flag]').first().click()
        cy.wait(100)
        cy.clickNavMenu('featureflags')
        cy.get('[data-attr=feature-flag-table]').should('contain', name + '-updated')

        cy.get(`[data-row-key=${name}-updated] [data-attr=more-button]`).click()
        cy.contains(`Try out in Insights`).click()
        cy.location().should((loc) => {
            expect(loc.pathname.toString()).to.contain('/insight')
        })
    })

    it('Delete and restore feature flag', () => {
        cy.get('[data-attr=top-bar-name]').should('contain', 'Feature flags')
        cy.get('[data-attr=new-feature-flag]').click()
        cy.get('[data-attr=feature-flag-key]').focus().type(name).should('have.value', name)
        cy.get('[data-attr=rollout-percentage]').type('{selectall}50').should('have.value', '50')
        cy.get('[data-attr=save-feature-flag]').first().click()

        // after save there should be a delete button
        cy.get('[data-attr="more-button"]').click()
        cy.get('button[data-attr="delete-feature-flag"]').should('have.text', 'Delete feature flag')

        cy.clickNavMenu('featureflags')
        cy.get('[data-attr=feature-flag-table]').should('contain', name)
        cy.get(`[data-row-key=${name}]`).contains(name).click()
        cy.get('[data-attr="more-button"]').click()
        cy.get('[data-attr=delete-feature-flag]').click()
        cy.get('.Toastify').contains('Undo').should('be.visible')

        // make sure the flag is deleted from list as expected
        cy.get('[data-attr=feature-flag-table]').should('not.contain', name)

        // navigate back to the deleted flag to make sure the edit button is disabled
        cy.go('back')
        cy.get('button[data-attr="edit-feature-flag"]').should('have.attr', 'aria-disabled', 'true')

        // undo the deletion
        cy.get('[data-attr="more-button"]').click()
        cy.get('button[data-attr="restore-feature-flag"]').should('have.text', 'Restore feature flag')
        cy.get('button[data-attr="restore-feature-flag"]').click()

        // refresh page and make sure the flag is restored as expected
        cy.reload()
        cy.get('button[data-attr="edit-feature-flag"]').should('not.have.attr', 'aria-disabled', 'true')
    })

    it('Search feature flags', () => {
        // Create a flag with a unique searchable name
        const searchableFlagName = 'searchable-flag-' + Math.floor(Math.random() * 10000000)
        cy.get('[data-attr=new-feature-flag]').click()
        cy.get('[data-attr=feature-flag-key]').click().type(searchableFlagName).should('have.value', searchableFlagName)
        cy.get('[data-attr=rollout-percentage]').clear().type('0')
        cy.get('[data-attr=save-feature-flag]').first().click()
        cy.wait(100)
        cy.clickNavMenu('featureflags')

        // create a flag with a name that should not show up in search results
        const nonSearchableFlagName = 'never-shows-up-' + Math.floor(Math.random() * 10000000)
        cy.get('[data-attr=new-feature-flag]').click()
        cy.get('[data-attr=feature-flag-key]')
            .click()
            .type(nonSearchableFlagName)
            .should('have.value', nonSearchableFlagName)
        cy.get('[data-attr=rollout-percentage]').clear().type('0')
        cy.get('[data-attr=save-feature-flag]').first().click()
        cy.wait(100)
        cy.clickNavMenu('featureflags')

        cy.get('[data-attr=top-bar-name]').should('contain', 'Feature flags')
        const searchTerm = searchableFlagName.substring(8, 20)
        cy.get('[data-attr=feature-flag-search]').focus().type(searchTerm).should('have.value', searchTerm)
        cy.get('[data-attr=feature-flag-table]').should('contain', searchableFlagName)
        cy.get('[data-attr=feature-flag-table]').should('not.contain', nonSearchableFlagName)
        cy.url().should('include', `search=${searchTerm}`)
        cy.reload()
        cy.get('[data-attr=feature-flag-search]').should('have.value', searchTerm)
    })

    it('Filter and sort feature flags', () => {
        cy.get('[data-attr=top-bar-name]').should('contain', 'Feature flags')

        cy.get('[data-attr=feature-flag-select-type').click()
        cy.get('[data-attr=feature-flag-select-type-option-multiple-variants]').click()
        cy.url().should('include', 'type=multivariant')

        // Make sure filtered empty state is shown
        cy.get('[data-attr=feature-flag-empty-state-filtered]').should('exist')

        // Create a disabled flag
        const disabledPrefixFlagName = `disabled-${name}`
        cy.get('[data-attr=new-feature-flag]').click()
        cy.get('[data-attr=feature-flag-key]')
            .click()
            .type(disabledPrefixFlagName)
            .should('have.value', disabledPrefixFlagName)
        cy.get('[data-attr=feature-flag-enabled-checkbox]').click()
        cy.get('[data-attr=rollout-percentage]').clear().type('0').should('have.value', '0')
        cy.get('[data-attr=save-feature-flag]').first().click()
        cy.wait(100)
        cy.clickNavMenu('featureflags')

        cy.get('[data-attr=feature-flag-select-status').click()
        cy.get('[data-attr=feature-flag-select-status-disabled]').click()
        cy.get('[data-attr=feature-flag-table]').should('contain', disabledPrefixFlagName)
        cy.url().should('include', 'active=false')

        // Make sure the filters are stil active after a page reload
        cy.reload()
        cy.get('[data-attr=feature-flag-select-status]').should('contain', 'Disabled')

        // Disable filters and sort by status to ensure a disabled flag is at the top of the list
        cy.get('[data-attr=feature-flag-select-status').click()
        cy.get('[data-attr=feature-flag-select-status-all]').click()

        // Click on the status column to sort by status
        cy.get('[data-attr=feature-flag-table]').contains('Status').click()
        // Make sure the first tr in the tbody of the feature-flag-table is a disabled flag
        cy.get(`[data-row-key=${disabledPrefixFlagName}]`).parent().first().contains('Disabled')
    })

    it('Move between property types smoothly, and support relative dates', () => {
        // ensure unique names to avoid clashes
        cy.get('[data-attr=top-bar-name]').should('contain', 'Feature flags')
        cy.get('[data-attr=new-feature-flag]').click()
        cy.get('[data-attr=feature-flag-key]').click().type(`{moveToEnd}${name}`).should('have.value', name)

        // select "add filter" and "property"
        cy.get('[data-attr=property-select-toggle-0').click()

        // select the first property
        cy.get('[data-attr=taxonomic-filter-searchfield]').click()
        cy.get('[data-attr=taxonomic-filter-searchfield]').type('is_demo')
        cy.get('[data-attr=taxonomic-tab-person_properties]').click()
        // select numeric $browser_version
        cy.get('[data-attr=prop-filter-person_properties-2]').click({ force: true })
        // select operator "is greater than" which isn't present for non-numeric properties
        cy.get('[data-attr=taxonomic-operator]').contains('= equals').click({ force: true })
        cy.get('.operator-value-option').contains('> greater than').click({ force: true })

        // selects the first value
        cy.get('[data-attr=prop-val]').click()
        cy.get('[data-attr=prop-val-0]').click({ force: true })

        // now change property type
        cy.get('[data-attr=property-select-toggle-0').click()
        cy.get('[data-attr=taxonomic-tab-person_properties]').click()

        // select dateTime date_prop
        cy.get('[data-attr=prop-filter-person_properties-3]').click({ force: true })
        cy.get('[data-attr=taxonomic-operator]').contains('= equals').click({ force: true })
        cy.get('.operator-value-option').contains('> after').click({ force: true })

        // By default says "Select a value"
        cy.get('[data-attr=taxonomic-value-select]').contains('Select a value').click()
        cy.get('.Popover__content').contains('Last 7 days').click({ force: true })
        cy.get('[data-attr=taxonomic-value-select]').contains('Last 7 days')

        // now change property type
        cy.get('[data-attr=property-select-toggle-0').click()
        cy.get('[data-attr=taxonomic-tab-person_properties]').click()
        // select regular prop
        cy.get('[data-attr=prop-filter-person_properties-1]').click({ force: true })
        cy.get('[data-attr=taxonomic-operator]').contains('= equals').click({ force: true })
        cy.get('.operator-value-option').contains('> after').should('not.exist')
    })
})
