import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../data/provider_listing_repository.dart';
import '../domain/provider_listing_models.dart';

enum _ListingTab { services, products }

class ProviderListingsPage extends ConsumerStatefulWidget {
  const ProviderListingsPage({super.key});

  @override
  ConsumerState<ProviderListingsPage> createState() =>
      _ProviderListingsPageState();
}

class _ProviderListingsPageState extends ConsumerState<ProviderListingsPage> {
  _ListingTab _tab = _ListingTab.services;
  String? _busyId;

  Future<void> _refresh() async {
    ref.invalidate(providerListingsProvider);
    await ref.read(providerListingsProvider.future);
  }

  Future<void> _openServiceSheet({
    MobileProviderServiceListing? service,
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _ServiceListingSheet(service: service),
    );
    if (saved == true && mounted) {
      await _refresh();
    }
  }

  Future<void> _openProductSheet({
    MobileProviderProductListing? product,
  }) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _ProductListingSheet(product: product),
    );
    if (saved == true && mounted) {
      await _refresh();
    }
  }

  Future<void> _delete({
    required MobileProviderListingType type,
    required String id,
  }) async {
    setState(() => _busyId = id);
    try {
      await ref
          .read(providerListingRepositoryProvider)
          .deleteListing(listingType: type, listingId: id);
      ref.invalidate(providerListingsProvider);
      await ref.read(providerListingsProvider.future);
      if (!mounted) {
        return;
      }
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Listing deleted.')));
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busyId = null);
      }
    }
  }

  Future<void> _toggleService(MobileProviderServiceListing service) async {
    setState(() => _busyId = service.id);
    try {
      await ref
          .read(providerListingRepositoryProvider)
          .updateService(
            listingId: service.id,
            values: service.toDraft(
              availabilityOverride: service.isActive ? 'offline' : 'available',
            ),
          );
      ref.invalidate(providerListingsProvider);
      await ref.read(providerListingsProvider.future);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              service.isActive ? 'Service paused.' : 'Service live.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busyId = null);
      }
    }
  }

  Future<void> _toggleProduct(MobileProviderProductListing product) async {
    setState(() => _busyId = product.id);
    try {
      await ref
          .read(providerListingRepositoryProvider)
          .updateProduct(
            listingId: product.id,
            values: product.toDraft(stockOverride: product.isActive ? 0 : 1),
          );
      ref.invalidate(providerListingsProvider);
      await ref.read(providerListingsProvider.future);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              product.isActive ? 'Product paused.' : 'Product live.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busyId = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final listings = ref.watch(providerListingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Listing manager'),
        actions: [
          IconButton(
            tooltip: 'Add listing',
            onPressed: _tab == _ListingTab.services
                ? () => _openServiceSheet()
                : () => _openProductSheet(),
            icon: const Icon(Icons.add_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              listings.when(
                data: (snapshot) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ListingManagerHero(snapshot: snapshot),
                    const SizedBox(height: 16),
                    _ListingStats(snapshot: snapshot),
                    const SizedBox(height: 16),
                    _ListingTabs(
                      selected: _tab,
                      onSelected: (tab) => setState(() => _tab = tab),
                    ),
                    const SizedBox(height: 16),
                    if (_tab == _ListingTab.services)
                      _ServiceList(
                        services: snapshot.services,
                        busyId: _busyId,
                        onAdd: () => _openServiceSheet(),
                        onEdit: (service) =>
                            _openServiceSheet(service: service),
                        onToggle: _toggleService,
                        onDelete: (service) => _delete(
                          type: MobileProviderListingType.service,
                          id: service.id,
                        ),
                      )
                    else
                      _ProductList(
                        products: snapshot.products,
                        busyId: _busyId,
                        onAdd: () => _openProductSheet(),
                        onEdit: (product) =>
                            _openProductSheet(product: product),
                        onToggle: _toggleProduct,
                        onDelete: (product) => _delete(
                          type: MobileProviderListingType.product,
                          id: product.id,
                        ),
                      ),
                  ],
                ),
                loading: () => const _ListingsLoading(),
                error: (error, _) => SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load listings',
                    message: AppErrorMapper.toMessage(error),
                    onRetry: _refresh,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ListingManagerHero extends StatelessWidget {
  const _ListingManagerHero({required this.snapshot});

  final MobileProviderListingsSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Manage what buyers can buy',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            'Create services and products, add images, update price or stock, and pause anything you cannot fulfill today.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (snapshot.compatibilityMode) ...[
            const SizedBox(height: 12),
            Text(
              'Some listing fields are hidden because the database is running in compatibility mode.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _ListingStats extends StatelessWidget {
  const _ListingStats({required this.snapshot});

  final MobileProviderListingsSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final stats = snapshot.stats;
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Live services',
                value: stats.activeServices.toString(),
                caption: '${stats.totalServices} total',
                icon: Icons.design_services_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'In stock',
                value: stats.activeProducts.toString(),
                caption: '${stats.totalProducts} products',
                icon: Icons.inventory_2_outlined,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ListingTabs extends StatelessWidget {
  const _ListingTabs({required this.selected, required this.onSelected});

  final _ListingTab selected;
  final ValueChanged<_ListingTab> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: [
        ChoiceChip(
          label: const Text('Services'),
          selected: selected == _ListingTab.services,
          onSelected: (_) => onSelected(_ListingTab.services),
        ),
        ChoiceChip(
          label: const Text('Products'),
          selected: selected == _ListingTab.products,
          onSelected: (_) => onSelected(_ListingTab.products),
        ),
      ],
    );
  }
}

class _ServiceList extends StatelessWidget {
  const _ServiceList({
    required this.services,
    required this.busyId,
    required this.onAdd,
    required this.onEdit,
    required this.onToggle,
    required this.onDelete,
  });

  final List<MobileProviderServiceListing> services;
  final String? busyId;
  final VoidCallback onAdd;
  final ValueChanged<MobileProviderServiceListing> onEdit;
  final ValueChanged<MobileProviderServiceListing> onToggle;
  final ValueChanged<MobileProviderServiceListing> onDelete;

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) {
      return SectionCard(
        child: EmptyStateView(
          title: 'No services yet',
          message:
              'Add your first service so customers can request or buy from the app.',
          actionLabel: 'Add service',
          onAction: onAdd,
        ),
      );
    }

    return Column(
      children: services
          .map(
            (service) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ServiceCard(
                service: service,
                busy: busyId == service.id,
                onEdit: () => onEdit(service),
                onToggle: () => onToggle(service),
                onDelete: () => onDelete(service),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _ProductList extends StatelessWidget {
  const _ProductList({
    required this.products,
    required this.busyId,
    required this.onAdd,
    required this.onEdit,
    required this.onToggle,
    required this.onDelete,
  });

  final List<MobileProviderProductListing> products;
  final String? busyId;
  final VoidCallback onAdd;
  final ValueChanged<MobileProviderProductListing> onEdit;
  final ValueChanged<MobileProviderProductListing> onToggle;
  final ValueChanged<MobileProviderProductListing> onDelete;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return SectionCard(
        child: EmptyStateView(
          title: 'No products yet',
          message:
              'Add products with price, stock, delivery mode, and an image.',
          actionLabel: 'Add product',
          onAction: onAdd,
        ),
      );
    }

    return Column(
      children: products
          .map(
            (product) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ProductCard(
                product: product,
                busy: busyId == product.id,
                onEdit: () => onEdit(product),
                onToggle: () => onToggle(product),
                onDelete: () => onDelete(product),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({
    required this.service,
    required this.busy,
    required this.onEdit,
    required this.onToggle,
    required this.onDelete,
  });

  final MobileProviderServiceListing service;
  final bool busy;
  final VoidCallback onEdit;
  final VoidCallback onToggle;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: _ListingCardBody(
        title: service.title,
        subtitle: service.description.isEmpty
            ? service.category
            : service.description,
        chips: [
          service.category,
          service.priceLabel,
          _humanize(service.pricingType),
          service.isActive ? 'Live' : 'Paused',
        ],
        busy: busy,
        onEdit: onEdit,
        onToggle: onToggle,
        toggleLabel: service.isActive ? 'Pause' : 'Resume',
        onDelete: onDelete,
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.busy,
    required this.onEdit,
    required this.onToggle,
    required this.onDelete,
  });

  final MobileProviderProductListing product;
  final bool busy;
  final VoidCallback onEdit;
  final VoidCallback onToggle;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: _ListingCardBody(
        title: product.title,
        subtitle: product.description.isEmpty
            ? product.category
            : product.description,
        imageUrl: product.imageUrl,
        chips: [
          product.category,
          product.priceLabel,
          '${product.stock} in stock',
          _humanize(product.deliveryMethod),
        ],
        busy: busy,
        onEdit: onEdit,
        onToggle: onToggle,
        toggleLabel: product.isActive ? 'Pause' : 'Resume',
        onDelete: onDelete,
      ),
    );
  }
}

class _ListingCardBody extends StatelessWidget {
  const _ListingCardBody({
    required this.title,
    required this.subtitle,
    required this.chips,
    required this.busy,
    required this.onEdit,
    required this.onToggle,
    required this.toggleLabel,
    required this.onDelete,
    this.imageUrl = '',
  });

  final String title;
  final String subtitle;
  final List<String> chips;
  final bool busy;
  final VoidCallback onEdit;
  final VoidCallback onToggle;
  final String toggleLabel;
  final VoidCallback onDelete;
  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (imageUrl.trim().isNotEmpty) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.sm),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(imageUrl, fit: BoxFit.cover),
            ),
          ),
          const SizedBox(height: 12),
        ],
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(
          subtitle,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: chips
              .map(
                (chip) => Chip(
                  label: Text(chip),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: busy ? null : onEdit,
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: busy ? null : onToggle,
                icon: busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.pause_circle_outline_rounded),
                label: Text(toggleLabel),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.outlined(
              tooltip: 'Delete',
              onPressed: busy ? null : onDelete,
              icon: const Icon(Icons.delete_outline_rounded),
            ),
          ],
        ),
      ],
    );
  }
}

class _ServiceListingSheet extends ConsumerStatefulWidget {
  const _ServiceListingSheet({this.service});

  final MobileProviderServiceListing? service;

  @override
  ConsumerState<_ServiceListingSheet> createState() =>
      _ServiceListingSheetState();
}

class _ServiceListingSheetState extends ConsumerState<_ServiceListingSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _title;
  late final TextEditingController _description;
  late final TextEditingController _category;
  late final TextEditingController _price;
  String _availability = 'available';
  String _pricingType = 'fixed';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final service = widget.service;
    _title = TextEditingController(text: service?.title ?? '');
    _description = TextEditingController(text: service?.description ?? '');
    _category = TextEditingController(text: service?.category ?? '');
    _price = TextEditingController(
      text: service == null || service.price <= 0
          ? ''
          : service.price.round().toString(),
    );
    _availability = service?.availability ?? 'available';
    _pricingType = service?.pricingType ?? 'fixed';
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _category.dispose();
    _price.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    final values = {
      'title': _title.text.trim(),
      'description': _description.text.trim(),
      'category': _category.text.trim(),
      'price': double.tryParse(_price.text.trim()) ?? 0,
      'availability': _availability,
      'pricingType': _pricingType,
    };
    try {
      final repo = ref.read(providerListingRepositoryProvider);
      final existing = widget.service;
      if (existing == null) {
        await repo.createService(values);
      } else {
        await repo.updateService(listingId: existing.id, values: values);
      }
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: widget.service == null ? 'Add service' : 'Edit service',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SheetTextField(
              controller: _title,
              label: 'Service title',
              validator: _required('Add a service title.'),
            ),
            _SheetTextField(
              controller: _description,
              label: 'Description',
              maxLines: 3,
            ),
            _SheetTextField(
              controller: _category,
              label: 'Category',
              validator: _required('Add a category.'),
            ),
            _SheetTextField(
              controller: _price,
              label: 'Price',
              keyboardType: TextInputType.number,
            ),
            _SheetDropdown(
              label: 'Pricing',
              value: _pricingType,
              values: const ['fixed', 'starting_at', 'hourly', 'quote'],
              onChanged: (value) => setState(() => _pricingType = value),
            ),
            const SizedBox(height: 12),
            _SheetDropdown(
              label: 'Availability',
              value: _availability,
              values: const ['available', 'busy', 'offline'],
              onChanged: (value) => setState(() => _availability = value),
            ),
            const SizedBox(height: 18),
            PrimaryButton(
              label: _saving ? 'Saving...' : 'Save service',
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductListingSheet extends ConsumerStatefulWidget {
  const _ProductListingSheet({this.product});

  final MobileProviderProductListing? product;

  @override
  ConsumerState<_ProductListingSheet> createState() =>
      _ProductListingSheetState();
}

class _ProductListingSheetState extends ConsumerState<_ProductListingSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _title;
  late final TextEditingController _description;
  late final TextEditingController _category;
  late final TextEditingController _price;
  late final TextEditingController _stock;
  late final TextEditingController _image;
  String _deliveryMethod = 'pickup';
  bool _saving = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _title = TextEditingController(text: product?.title ?? '');
    _description = TextEditingController(text: product?.description ?? '');
    _category = TextEditingController(text: product?.category ?? '');
    _price = TextEditingController(
      text: product == null || product.price <= 0
          ? ''
          : product.price.round().toString(),
    );
    _stock = TextEditingController(text: product?.stock.toString() ?? '1');
    _image = TextEditingController(text: product?.imageUrl ?? '');
    _deliveryMethod = product?.deliveryMethod ?? 'pickup';
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _category.dispose();
    _price.dispose();
    _stock.dispose();
    _image.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 82,
      maxWidth: 1800,
    );
    if (picked == null) {
      return;
    }

    setState(() => _uploading = true);
    try {
      final path = await ref
          .read(providerListingRepositoryProvider)
          .uploadListingImage(
            filePath: picked.path,
            fileName: picked.name,
            mediaType: picked.mimeType ?? _mimeFromName(picked.name),
          );
      _image.text = path;
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _uploading = false);
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    final values = {
      'title': _title.text.trim(),
      'description': _description.text.trim(),
      'category': _category.text.trim(),
      'price': double.tryParse(_price.text.trim()) ?? 0,
      'stock': int.tryParse(_stock.text.trim()) ?? 0,
      'deliveryMethod': _deliveryMethod,
      'imageUrl': _image.text.trim(),
    };
    try {
      final repo = ref.read(providerListingRepositoryProvider);
      final existing = widget.product;
      if (existing == null) {
        await repo.createProduct(values);
      } else {
        await repo.updateProduct(listingId: existing.id, values: values);
      }
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: widget.product == null ? 'Add product' : 'Edit product',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SheetTextField(
              controller: _title,
              label: 'Product title',
              validator: _required('Add a product title.'),
            ),
            _SheetTextField(
              controller: _description,
              label: 'Description',
              maxLines: 3,
            ),
            _SheetTextField(
              controller: _category,
              label: 'Category',
              validator: _required('Add a category.'),
            ),
            _SheetTextField(
              controller: _price,
              label: 'Price',
              keyboardType: TextInputType.number,
            ),
            _SheetTextField(
              controller: _stock,
              label: 'Stock',
              keyboardType: TextInputType.number,
            ),
            _SheetDropdown(
              label: 'Delivery',
              value: _deliveryMethod,
              values: const ['pickup', 'delivery', 'both'],
              onChanged: (value) => setState(() => _deliveryMethod = value),
            ),
            const SizedBox(height: 12),
            _SheetTextField(controller: _image, label: 'Image path or URL'),
            SecondaryButton(
              label: _uploading ? 'Uploading...' : 'Pick image',
              icon: _uploading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.photo_library_outlined),
              onPressed: _uploading ? null : _pickImage,
            ),
            const SizedBox(height: 18),
            PrimaryButton(
              label: _saving ? 'Saving...' : 'Save product',
              onPressed: _saving || _uploading ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}

class _SheetScaffold extends StatelessWidget {
  const _SheetScaffold({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.9,
        minChildSize: 0.55,
        builder: (context, scrollController) {
          return ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    onPressed: () => Navigator.of(context).pop(false),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              child,
            ],
          );
        },
      ),
    );
  }
}

class _SheetTextField extends StatelessWidget {
  const _SheetTextField({
    required this.controller,
    required this.label,
    this.maxLines = 1,
    this.keyboardType,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final int maxLines;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        keyboardType: keyboardType,
        decoration: InputDecoration(labelText: label),
        validator: validator,
      ),
    );
  }
}

class _SheetDropdown extends StatelessWidget {
  const _SheetDropdown({
    required this.label,
    required this.value,
    required this.values,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<String> values;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(labelText: label),
      items: values
          .map(
            (item) => DropdownMenuItem<String>(
              value: item,
              child: Text(_humanize(item)),
            ),
          )
          .toList(),
      onChanged: (next) {
        if (next != null) {
          onChanged(next);
        }
      },
    );
  }
}

class _ListingsLoading extends StatelessWidget {
  const _ListingsLoading();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 20, width: 160),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 10),
                LoadingShimmer(height: 72),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String? Function(String?) _required(String message) {
  return (value) {
    if ((value ?? '').trim().isEmpty) {
      return message;
    }
    return null;
  };
}

String _mimeFromName(String name) {
  final lower = name.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

String _humanize(String raw) {
  return raw
      .split('_')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}
