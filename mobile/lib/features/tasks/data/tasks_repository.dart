import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mock/serviq_mock_store.dart';
import '../../../core/models/serviq_models.dart';

final tasksRepositoryProvider = Provider<TasksRepository>((ref) {
  return TasksRepository(ref);
});

final tasksBoardProvider = FutureProvider<TasksBoard>((ref) async {
  return ref.read(tasksRepositoryProvider).fetchBoard();
});

final taskDetailProvider = FutureProvider.family<TaskItem?, String>((
  ref,
  taskId,
) async {
  return ref.read(tasksRepositoryProvider).fetchTask(taskId);
});

class TasksRepository {
  TasksRepository(this._ref);

  final Ref _ref;

  Future<TasksBoard> fetchBoard() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final state = _ref.read(serviqMockStoreProvider);
    return TasksBoard(items: state.tasks);
  }

  Future<TaskItem?> fetchTask(String taskId) async {
    await Future<void>.delayed(const Duration(milliseconds: 160));
    final state = _ref.read(serviqMockStoreProvider);
    try {
      return state.tasks.firstWhere((task) => task.id == taskId);
    } catch (_) {
      return null;
    }
  }

  Future<void> updateStatus(TaskItem task, TaskStatus nextStatus) async {
    _ref
        .read(serviqMockStoreProvider.notifier)
        .updateTaskStatus(task, nextStatus);
  }
}
