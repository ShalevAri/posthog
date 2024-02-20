import './PlanComparison.scss'

import { LemonButton, LemonModal, LemonTag, Link } from '@posthog/lemon-ui'
import clsx from 'clsx'
import { useActions, useValues } from 'kea'
import { IconCheckmark, IconClose, IconWarning } from 'lib/lemon-ui/icons'
import { Tooltip } from 'lib/lemon-ui/Tooltip'
// import { IconCheck } from '@posthog/icons'
import { Tooltip } from 'lib/lemon-ui/Tooltip'
import { eventUsageLogic } from 'lib/utils/eventUsageLogic'
import React from 'react'
import { getProductIcon } from 'scenes/products/Products'
import useResizeObserver from 'use-resize-observer'

import { BillingProductV2AddonType, BillingProductV2Type, BillingV2FeatureType, BillingV2PlanType } from '~/types'

import { convertLargeNumberToWords, getUpgradeProductLink } from './billing-utils'
import { billingLogic } from './billingLogic'

export function PlanIcon({
    feature,
    className,
    timeDenominator,
}: {
    feature?: BillingV2FeatureType
    className?: string
    timeDenominator?: string
}): JSX.Element {
    return (
        <div className="flex items-center text-xs text-muted">
            {!feature ? (
                <>
                    <IconClose className={clsx('text-danger mx-4', className)} />
                </>
            ) : feature.limit ? (
                <>
                    <IconWarning className={clsx('text-warning mx-4 shrink-0', className)} />
                    {feature.limit &&
                        `${convertLargeNumberToWords(feature.limit, null)} ${feature.unit && feature.unit}${
                            timeDenominator ? `/${timeDenominator}` : ''
                        }`}
                    {feature.note}
                </>
            ) : (
                <>
                    <IconCheckmark className={clsx('text-success mx-4 shrink-0', className)} />
                    {feature.note}
                </>
            )}
        </div>
    )
}

const getProductTiers = (
    plan: BillingV2PlanType,
    product: BillingProductV2Type | BillingProductV2AddonType
): JSX.Element => {
    const { width, ref: tiersRef } = useResizeObserver()
    const tiers = plan?.tiers

    const allTierPrices = tiers?.map((tier) => parseFloat(tier.unit_amount_usd))
    const sigFigs = allTierPrices?.map((price) => price?.toString().split('.')[1]?.length).sort((a, b) => b - a)[0]

    return (
        <>
            {tiers ? (
                tiers?.map((tier, i) => (
                    <div
                        key={`${plan.plan_key}-${product.type}-${tier.up_to}`}
                        className={clsx(
                            'flex',
                            width && width < 100 ? 'flex-col mb-2' : 'justify-between items-center'
                        )}
                        ref={tiersRef}
                    >
                        <span className="text-xs">
                            {convertLargeNumberToWords(tier.up_to, tiers[i - 1]?.up_to, true, product.unit)}
                        </span>
                        <span className="font-bold">
                            {i === 0 && parseFloat(tier.unit_amount_usd) === 0
                                ? 'Free'
                                : `$${parseFloat(tier.unit_amount_usd).toFixed(sigFigs)}`}
                        </span>
                    </div>
                ))
            ) : product?.free_allocation ? (
                <div
                    key={`${plan.plan_key}-${product.type}-tiers`}
                    className={clsx('flex', width && width < 100 ? 'flex-col mb-2' : ' justify-between items-center')}
                    ref={tiersRef}
                >
                    <span className="text-xs">
                        Up to {convertLargeNumberToWords(product?.free_allocation, null)} {product?.unit}s/mo
                    </span>
                    <span className="font-bold">Free</span>
                </div>
            ) : null}
        </>
    )
}

export const PlanComparison = ({
    product,
    includeAddons = false,
}: {
    product: BillingProductV2Type
    includeAddons?: boolean
}): JSX.Element | null => {
    const plans = product.plans
    if (plans?.length === 0) {
        return null
    }
    const fullyFeaturedPlan = plans[plans.length - 1]
    const { reportBillingUpgradeClicked } = useActions(eventUsageLogic)
    const { redirectPath, billing } = useValues(billingLogic)
    const { width, ref: planComparisonRef } = useResizeObserver()

    const upgradeButtons = plans?.map((plan) => {
        return (
            <div key={`${plan.plan_key}-cta`} className="col-span-4 px-3 py-2 text-sm">
                <LemonButton
                    to={getUpgradeProductLink(product, plan.plan_key || '', redirectPath, includeAddons)}
                    type={plan.current_plan ? 'secondary' : 'primary'}
                    status={plan.current_plan ? 'default' : 'alt'}
                    fullWidth
                    center
                    disableClientSideRouting
                    disabled={plan.current_plan}
                    onClick={() => {
                        if (!plan.current_plan) {
                            reportBillingUpgradeClicked(product.type)
                        }
                    }}
                >
                    {plan.current_plan ? 'Current plan' : 'Upgrade'}
                </LemonButton>
                {!plan.current_plan && includeAddons && product.addons?.length > 0 && (
                    <p className="text-center ml-0 mt-2 mb-0">
                        <Link
                            to={`/api/billing-v2/activation?products=${product.type}:${plan.plan_key}&redirect_path=${redirectPath}`}
                            className="text-muted text-xs"
                            disableClientSideRouting
                        >
                            or upgrade without addons
                        </Link>
                    </p>
                )}
            </div>
        )
    })

    return (
        <>
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" ref={planComparisonRef}>
                <div className="grid grid-cols-12 mb-1">
                    <div className="col-span-4 px-3 py-1">&nbsp;</div>
                    {plans?.map((plan) => (
                        <div className="col-span-4 px-3 py-1" key={`plan-type-${plan.plan_key}`}>
                            <strong>{plan.free_allocation && !plan.tiers ? 'Free' : 'Paid'}</strong>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-12 mb-1 border-x border-b [&>div]:border-t">
                    <div className="col-span-full bg-accent -dark:bg-accent-dark font-bold px-3 py-1 text-sm -dark:text-white">
                        Pricing
                    </div>

                    <div className="col-span-4 bg-accent/50 dark:bg-black/75 px-3 py-2 text-sm">
                        {/* {row.tooltip ? ( */}
                        <Tooltip title="Title goes here">
                            <strong className="border-b border-dashed border-light dark:border-dark cursor-help text-opacity-75">
                                Monthly base price
                            </strong>
                        </Tooltip>
                        {/*
                        ) : (
                            <strong className="text-primary/75 dark:text-primary-dark/75">
                                {row.key}
                            </strong>
                        )}
                        */}
                    </div>

                    {plans?.map((plan) => (
                        <div className="col-span-4 px-3 py-2 text-sm" key={`${plan.plan_key}-basePrice`}>
                            {plan.free_allocation && !plan.tiers ? 'Free forever' : '$0 per month'}
                        </div>
                    ))}

                    <div className="col-span-4 bg-accent/50 dark:bg-black/75 px-3 py-2 text-sm">
                        {includeAddons && product.addons?.length > 0 && (
                            <p className="m-0">
                                <span className="font-bold">{product.name}</span>
                            </p>
                        )}
                        <p className="text-xs">Priced per {product.unit}</p>
                    </div>
                    {plans?.map((plan) => (
                        <div className="col-span-4 px-3 py-2 text-sm" key={`${plan.plan_key}-tiers-td`}>
                            <span>{getProductTiers(plan, product)}</span>
                        </div>
                    ))}

                    {includeAddons &&
                        product.addons?.map((addon) => {
                            return addon.tiered ? (
                                <React.Fragment key={addon.name + 'pricing-row'}>
                                    <div className="col-span-4 bg-accent/50 dark:bg-black/75 px-3 py-2 text-sm">
                                        <p className="m-0">
                                            <span className="font-bold">{addon.name}</span>
                                            <LemonTag type="completion" className="ml-2">
                                                addon
                                            </LemonTag>
                                        </p>
                                        <p className="text-xs text-muted">Priced per {addon.unit}</p>
                                    </div>
                                    {plans?.map((plan) =>
                                        // If the plan is free, the addon isn't available
                                        plan.free_allocation && !plan.tiers ? (
                                            <div
                                                className="col-span-4 px-3 py-2 text-sm"
                                                key={`${addon.name}-free-tiers-td`}
                                            >
                                                <p className="text-muted text-xs">Not available on this plan.</p>
                                            </div>
                                        ) : (
                                            <div
                                                className="col-span-4 px-3 py-2 text-sm"
                                                key={`${addon.type}-tiers-td`}
                                            >
                                                {getProductTiers(addon.plans?.[0], addon)}
                                            </div>
                                        )
                                    )}
                                </React.Fragment>
                            ) : null
                        })}
                </div>

                <div className="grid grid-cols-12">
                    <div className="col-span-4 px-3 py-2 text-sm">&nbsp;</div>
                    {upgradeButtons}
                </div>
            </div>

            <br />
            <hr />
            <hr />
            <hr />
            <br />
            <table className="PlanComparison w-full table-fixed" ref={planComparisonRef}>
                <tbody>
                    {/* Pricing section */}

                    <tr>
                        <td />
                        !!!
                    </tr>
                    <tr>
                        <th colSpan={3} className="PlanTable__th__section bg-side justify-left rounded text-left mb-2">
                            <div className="flex items-center gap-x-2 my-2">
                                {getProductIcon(product.icon_key, 'text-2xl')}
                                <Tooltip title={product.description}>
                                    <span className="font-bold">{product.name}</span>
                                </Tooltip>
                            </div>
                        </th>
                    </tr>

                    {fullyFeaturedPlan?.features?.map((feature, i) => (
                        <tr
                            key={`tr-${feature.key}`}
                            className={
                                i == fullyFeaturedPlan?.features?.length - 1 && !billing?.has_active_subscription
                                    ? 'PlanTable__tr__border'
                                    : ''
                            }
                        >
                            <th
                                className={clsx(
                                    'PlanTable__th__feature',
                                    width && width < 600 && 'PlanTable__th__feature--reduced_padding',
                                    i == fullyFeaturedPlan?.features?.length - 1 && 'PlanTable__th__last-feature'
                                )}
                            >
                                <Tooltip title={feature.description}>{feature.name}</Tooltip>
                            </th>
                            {plans?.map((plan) => (
                                <td key={`${plan.plan_key}-${feature.key}`}>
                                    <PlanIcon
                                        feature={plan.features?.find(
                                            (thisPlanFeature) => feature.key === thisPlanFeature.key
                                        )}
                                        className="text-base"
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}

                    {!billing?.has_active_subscription && (
                        <>
                            <tr>
                                <th colSpan={3} className="PlanTable__th__section rounded text-left">
                                    <p className="mt-6 mb-2 italic text-center text-muted">
                                        <Tooltip title="Organizations with any paid subscription get access to additional features.">
                                            Included platform features:
                                        </Tooltip>
                                    </p>
                                </th>
                            </tr>
                            {billing?.products
                                .filter((product) => product.inclusion_only)
                                .map((includedProduct) => (
                                    <React.Fragment key={`inclusion-only-product-features-${includedProduct.type}`}>
                                        <tr>
                                            <th
                                                colSpan={3}
                                                className="PlanTable__th__section bg-side justify-left rounded text-left mb-2"
                                            >
                                                <div className="flex items-center gap-x-2 my-2">
                                                    {getProductIcon(includedProduct.icon_key, 'text-2xl')}
                                                    <Tooltip title={includedProduct.description}>
                                                        <span className="font-bold">{includedProduct.name}</span>
                                                    </Tooltip>
                                                </div>
                                            </th>
                                        </tr>
                                        {includedProduct.plans
                                            .find((plan: BillingV2PlanType) => plan.included_if == 'has_subscription')
                                            ?.features?.map((feature, i) => (
                                                <tr key={`tr-${feature.key}`}>
                                                    <th
                                                        className={clsx(
                                                            'text-muted PlanTable__th__feature',
                                                            width &&
                                                                width < 600 &&
                                                                'PlanTable__th__feature--reduced_padding',
                                                            // If this is the last feature in the list, add a class to add padding to the bottom of
                                                            // the cell (which makes the whole row have the padding)
                                                            i ==
                                                                (includedProduct.plans.find(
                                                                    (plan) => plan.included_if == 'has_subscription'
                                                                )?.features?.length || 0) -
                                                                    1
                                                                ? 'PlanTable__th__last-feature'
                                                                : ''
                                                        )}
                                                    >
                                                        <Tooltip title={feature.description}>{feature.name}</Tooltip>
                                                    </th>
                                                    {includedProduct.plans?.map((plan) => (
                                                        <React.Fragment key={`${plan.plan_key}-${feature.key}`}>
                                                            {/* Some products don't have a free plan, so we need to pretend there is one 
                                                                        so the features line up in the correct columns in the UI. This is kind of 
                                                                        hacky because it assumes we only have 2 plans total, but it works for now.
                                                                    */}
                                                            {includedProduct.plans?.length === 1 && (
                                                                <td>
                                                                    <PlanIcon
                                                                        feature={undefined}
                                                                        className="text-base"
                                                                    />
                                                                </td>
                                                            )}
                                                            <td>
                                                                <PlanIcon
                                                                    feature={plan.features?.find(
                                                                        (thisPlanFeature) =>
                                                                            feature.key === thisPlanFeature.key
                                                                    )}
                                                                    className="text-base"
                                                                />
                                                            </td>
                                                        </React.Fragment>
                                                    ))}
                                                </tr>
                                            ))}
                                    </React.Fragment>
                                ))}
                        </>
                    )}
                </tbody>
            </table>
        </>
    )
}

export const PlanComparisonModal = ({
    product,
    includeAddons = false,
    modalOpen,
    onClose,
}: {
    product: BillingProductV2Type
    includeAddons?: boolean
    modalOpen: boolean
    onClose?: () => void
}): JSX.Element | null => {
    return (
        <LemonModal isOpen={modalOpen} onClose={onClose}>
            <div className="PlanComparisonModal flex w-full h-full justify-center p-8">
                <div className="text-left bg-bg-light rounded relative w-full">
                    <h2>{product.name} plans</h2>
                    <PlanComparison product={product} includeAddons={includeAddons} />
                </div>
            </div>
        </LemonModal>
    )
}
