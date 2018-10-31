<?php
/**
 * @category    pimcore
 * @date        25/10/2018
 * @author      Michał Bolka <mbolka@divante.co>
 * @copyright   Copyright (c) 2018 DIVANTE (https://divante.co)
 */


namespace WorkflowGuiBundle\Compiler;

use Pimcore\Model\Asset;
use Pimcore\Model\DataObject\ClassDefinition;
use Pimcore\Model\Document;
use Pimcore\Workflow\Manager;
use Pimcore\Workflow\Transition;
use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ChildDefinition;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\DependencyInjection\Definition;
use Symfony\Component\DependencyInjection\Loader\YamlFileLoader;
use Symfony\Component\DependencyInjection\Reference;
use Symfony\Component\Security\Core\Authorization\ExpressionLanguage;
use Symfony\Component\Security\Core\Security;
use Symfony\Component\Workflow;
use Symfony\Component\Workflow\Exception\LogicException;

class WorkflowPass implements CompilerPassInterface
{
    /**
     * @inheritDoc
     */
    public function process(ContainerBuilder $container)
    {
        $list = new \Pimcore\Model\Workflow\Listing();
        $list->load();

        $items = $list->getWorkflows();
        $workflowManagerDefinition = $container->getDefinition(Manager::class);

        /** @var \Pimcore\Model\Workflow $workflow */
        foreach ($items as $workflow) {
            if (!$workflow->getEnabled()) {
                continue;
            }
            $workflowName = $workflow->getName();
            $type = 'workflow';

            $workflowManagerDefinition->addMethodCall(
                'registerWorkflow',
                [
                    $workflow->getName(),
                    [
                        'label' => $workflow->getName(),
                        'priority' => 0,
                        'type' => $type,
                    ],
                ]
            );
            $transitions = [];
            foreach ($workflow->getActions() as $action) {
                $action['options']['id'] = $workflow->getId();

                $transitions[] = new Definition(
                    Transition::class,
                    [
                        $action['name'],
                        $action['transitionFrom'],
                        $action['transitionTo'],
                        $action['options'],
                    ]
                );
            }
            $places = [];
            foreach ($workflow->getStatuses() as $place) {
                $places[] = $place['name'];
                $place['visibleInHeader'] = true;
                $workflowManagerDefinition->addMethodCall('addPlaceConfig', [$workflowName, $place['name'], $place]);
            }

            $markingStoreType =  null;
            $markingStoreService = null;

            if (is_null($markingStoreService) && is_null($markingStoreType)) {
                $markingStoreType = 'state_table';
            }

            // Create a Definition
            $definitionDefinition = new Definition(Workflow\Definition::class);
            $definitionDefinition->setPublic(false);
            $definitionDefinition->addArgument($places);
            $definitionDefinition->addArgument($transitions);
            $definitionDefinition->addTag(
                'workflow.definition',
                [
                    'name' => $workflowName,
                    'type' => $type,
                    'marking_store' => $markingStoreType,
                ]
            );
            if ($workflow->getDefaultStatus()) {
                $definitionDefinition->addArgument($workflow->getDefaultStatus());
            }

            // Create MarkingStore
            if (!is_null($markingStoreType)) {
                $markingStoreDefinition = new ChildDefinition('workflow.marking_store.'.$markingStoreType);

                if ($markingStoreType === 'state_table' || $markingStoreType === 'data_object_splitted_state') {
                    $markingStoreDefinition->addArgument($workflowName);
                }

                if ($markingStoreType === 'data_object_splitted_state') {
                    $markingStoreDefinition->addArgument($places);
                }

                foreach ($workflowConfig['marking_store']['arguments'] ?? [] as $argument) {
                    $markingStoreDefinition->addArgument($argument);
                }
            } elseif (!is_null($markingStoreService)) {
                $markingStoreDefinition = new Reference($markingStoreService);
            }

            // Create Workflow
            $workflowId = sprintf('%s.%s', $type, $workflowName);
            $workflowDefinition = new ChildDefinition(sprintf('%s.abstract', $type));
            $workflowDefinition->replaceArgument(0, new Reference(sprintf('%s.definition', $workflowId)));
            if (isset($markingStoreDefinition)) {
                $workflowDefinition->replaceArgument(1, $markingStoreDefinition);
            }
            $workflowDefinition->replaceArgument(3, $workflowName);

            // Store to container
            $container->setDefinition($workflowId, $workflowDefinition);
            $container->setDefinition(sprintf('%s.definition', $workflowId), $definitionDefinition);

            $registryDefinition = $container->getDefinition('workflow.registry');
            $supportedTypes = [];
            foreach ($workflow->getWorkflowSubject()['types'] as $type) {
                $supportedTypes[] = $type;
            }
            $supportedClasses = [];
            foreach ($workflow->getWorkflowSubject()['types'] as $type) {
                if ($type == 'object') {
                    foreach ($workflow->getWorkflowSubject()['classes'] as $class) {
                        $supportedClasses[] = '\\Pimcore\\Model\\DataObject\\' . $class['text'];
                    }
                } elseif ($type == 'asset') {
                    $supportedClasses[] = Asset::class;

                } elseif ($type == 'document') {
                    $supportedClasses[] = Document::class;
                }
            }
            // Add workflow to Registry
                foreach ($supportedClasses as $supportedClassName) {
                    $strategyDefinition = new Definition(
                        Workflow\SupportStrategy\ClassInstanceSupportStrategy::class,
                        [$supportedClassName]
                    );
                    $strategyDefinition->setPublic(false);
                    $registryDefinition->addMethodCall('add', [new Reference($workflowId), $strategyDefinition]);
                }

//           elseif (isset($workflowConfig['support_strategy'])) {
//                $supportStrategyType = $workflowConfig['support_strategy']['type'] ?? null;
//
//                if (!is_null($supportStrategyType)) {
//                    $supportStrategyDefinition = new ChildDefinition('workflow.support_strategy.'.$supportStrategyType);
//
//                    foreach ($workflowConfig['support_strategy']['arguments'] ?? [] as $argument) {
//                        $supportStrategyDefinition->addArgument($argument);
//                    }
//                    $registryDefinition->addMethodCall('add', [new Reference($workflowId), $supportStrategyDefinition]);
//                } elseif (isset($workflowConfig['support_strategy']['service'])) {
//                    $registryDefinition->addMethodCall(
//                        'add',
//                        [new Reference($workflowId), new Reference($workflowConfig['support_strategy']['service'])]
//                    );
//                }
//            }

            // Enable the AuditTrail
            if ($workflowConfig['audit_trail']['enabled']) {
                $listener = new Definition(Workflow\EventListener\AuditTrailListener::class);
                $listener->setPrivate(true);
                $listener->addTag('monolog.logger', ['channel' => 'workflow']);
                $listener->addTag(
                    'kernel.event_listener',
                    ['event' => sprintf('workflow.%s.leave', $workflowName), 'method' => 'onLeave']
                );
                $listener->addTag(
                    'kernel.event_listener',
                    ['event' => sprintf('workflow.%s.transition', $workflowName), 'method' => 'onTransition']
                );
                $listener->addTag(
                    'kernel.event_listener',
                    ['event' => sprintf('workflow.%s.enter', $workflowName), 'method' => 'onEnter']
                );
                $listener->addArgument(new Reference('logger'));
                $container->setDefinition(sprintf('%s.listener.audit_trail', $workflowId), $listener);
            }

            // Add Guard Listener
            $guard = new Definition(Workflow\EventListener\GuardListener::class);
            $guard->setPrivate(true);
            $configuration = [];
//            foreach ($workflowConfig['transitions'] as $transitionName => $config) {
//                if (!isset($config['guard'])) {
//                    continue;
//                }
//
//                if (!class_exists(ExpressionLanguage::class)) {
//                    throw new LogicException(
//                        'Cannot guard workflows as the ExpressionLanguage component is not installed.'
//                    );
//                }
//
//                if (!class_exists(Security::class)) {
//                    throw new LogicException('Cannot guard workflows as the Security component is not installed.');
//                }
//
//                $eventName = sprintf('workflow.%s.guard.%s', $workflowName, $transitionName);
//                $guard->addTag('kernel.event_listener', ['event' => $eventName, 'method' => 'onTransition']);
//                $configuration[$eventName] = $config['guard'];
//            }
            if ($configuration) {
                $guard->setArguments(
                    [
                        $configuration,
                        new Reference('workflow.security.expression_language'),
                        new Reference('security.token_storage'),
                        new Reference('security.authorization_checker'),
                        new Reference('security.authentication.trust_resolver'),
                        new Reference('security.role_hierarchy'),
                        new Reference('validator', ContainerInterface::NULL_ON_INVALID_REFERENCE),
                    ]
                );

                $container->setDefinition(sprintf('%s.listener.guard', $workflowId), $guard);
                $container->setParameter('workflow.has_guard_listeners', true);
            }
        }
    }
}
